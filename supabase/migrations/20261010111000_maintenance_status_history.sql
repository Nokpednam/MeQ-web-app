-- Record every maintenance status change so admins can see how a report was
-- followed up and the project can measure time from report to resolution.
-- RESOLVED and REJECTED are both closed states that release the active-issue
-- slot for the same court and category.
create table public.maintenance_status_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  from_status public.maintenance_status,
  to_status public.maintenance_status not null,
  admin_note text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index maintenance_status_history_report_idx
  on public.maintenance_status_history(report_id, changed_at);

alter table public.maintenance_status_history enable row level security;
revoke all on public.maintenance_status_history from public, anon, authenticated;

-- Backfill: creation entry for every report, plus one entry for the current
-- status when it already moved on. Exact intermediate times are unknown.
insert into public.maintenance_status_history(report_id, from_status, to_status, changed_by, changed_at)
select report.id, null, 'NEW', report.reporter_user_id, report.created_at
from public.maintenance_reports report;

insert into public.maintenance_status_history(report_id, from_status, to_status, admin_note, changed_at)
select report.id, 'NEW', report.status, report.admin_note, report.updated_at
from public.maintenance_reports report
where report.status <> 'NEW';

create or replace function private.is_closed_maintenance_status(p_status public.maintenance_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('RESOLVED', 'REJECTED');
$$;

-- Move the active-issue slot to the newest other open report, or free it.
create or replace function private.release_maintenance_active_issue(p_report public.maintenance_reports)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replacement_id uuid;
begin
  select report.id into v_replacement_id
  from public.maintenance_reports report
  where report.court_id = p_report.court_id
    and report.category = p_report.category
    and not private.is_closed_maintenance_status(report.status)
    and report.id <> p_report.id
  order by report.created_at desc, report.id desc
  limit 1;

  if v_replacement_id is not null then
    update public.maintenance_active_issues
    set report_id = v_replacement_id,
        created_at = now()
    where report_id = p_report.id;
  else
    delete from public.maintenance_active_issues
    where report_id = p_report.id;
  end if;
end;
$$;

revoke execute on function private.release_maintenance_active_issue(public.maintenance_reports) from public, anon, authenticated;

create or replace function public.create_maintenance_report(
  p_court_id text,
  p_category public.maintenance_category,
  p_details text,
  p_image_path text default null
)
returns public.maintenance_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_report public.maintenance_reports;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_image_path is not null
    and p_image_path not like v_user_id::text || '/%' then
    raise exception using errcode = '42501', message = 'INVALID_IMAGE_PATH';
  end if;

  insert into public.maintenance_reports(
    reporter_user_id, court_id, category, details, image_path
  ) values (
    v_user_id, p_court_id, p_category, trim(p_details), p_image_path
  ) returning * into v_report;

  begin
    insert into public.maintenance_active_issues(court_id, category, report_id)
    values (p_court_id, p_category, v_report.id);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'DUPLICATE_ACTIVE_REPORT';
  end;

  insert into public.maintenance_status_history(report_id, from_status, to_status, changed_by)
  values (v_report.id, null, 'NEW', v_user_id);

  return v_report;
end;
$$;

create or replace function public.admin_update_maintenance_status(
  p_report_id uuid,
  p_status public.maintenance_status,
  p_admin_note text default null
)
returns public.maintenance_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.maintenance_reports;
  v_previous_status public.maintenance_status;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;

  select * into v_report
  from public.maintenance_reports
  where id = p_report_id
  for update;
  if v_report.id is null then
    raise exception using errcode = 'P0002', message = 'REPORT_NOT_FOUND';
  end if;
  v_previous_status := v_report.status;

  -- Reopening a closed report needs the active-issue slot back.
  if private.is_closed_maintenance_status(v_previous_status)
    and not private.is_closed_maintenance_status(p_status) then
    begin
      insert into public.maintenance_active_issues(court_id, category, report_id)
      values (v_report.court_id, v_report.category, v_report.id);
    exception when unique_violation then
      raise exception using errcode = '23505', message = 'DUPLICATE_ACTIVE_REPORT';
    end;
  end if;

  update public.maintenance_reports
  set status = p_status,
      admin_note = v_note,
      updated_at = now()
  where id = p_report_id
  returning * into v_report;

  if private.is_closed_maintenance_status(p_status)
    and not private.is_closed_maintenance_status(v_previous_status) then
    perform private.release_maintenance_active_issue(v_report);
  end if;

  if v_previous_status <> p_status
    or v_note is distinct from (
      select history.admin_note
      from public.maintenance_status_history history
      where history.report_id = p_report_id
      order by history.changed_at desc, history.id desc
      limit 1
    ) then
    insert into public.maintenance_status_history(report_id, from_status, to_status, admin_note, changed_by)
    values (p_report_id, v_previous_status, p_status, v_note, auth.uid());
  end if;

  return v_report;
end;
$$;

create or replace function public.admin_delete_maintenance_report(
  p_report_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.maintenance_reports;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;

  select * into v_report
  from public.maintenance_reports
  where id = p_report_id
  for update;
  if v_report.id is null then
    raise exception using errcode = 'P0002', message = 'REPORT_NOT_FOUND';
  end if;

  perform private.release_maintenance_active_issue(v_report);
  -- A replacement may not exist; make sure no slot still points here.
  delete from public.maintenance_active_issues where report_id = v_report.id;

  delete from public.maintenance_reports where id = v_report.id;

  return v_report.image_path;
end;
$$;

create or replace function public.admin_list_maintenance_history(p_report_ids uuid[])
returns table(
  report_id uuid,
  from_status public.maintenance_status,
  to_status public.maintenance_status,
  admin_note text,
  changed_by_name text,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;

  return query
  select history.report_id, history.from_status, history.to_status,
    history.admin_note, profile.display_name, history.changed_at
  from public.maintenance_status_history history
  left join public.profiles profile on profile.id = history.changed_by
  where history.report_id = any(p_report_ids)
  order by history.report_id, history.changed_at, history.id;
end;
$$;

revoke execute on function public.admin_list_maintenance_history(uuid[]) from public, anon;
grant execute on function public.admin_list_maintenance_history(uuid[]) to authenticated;
