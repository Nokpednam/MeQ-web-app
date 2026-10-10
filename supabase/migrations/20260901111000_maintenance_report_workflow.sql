-- Keep one unresolved issue per court and category. The registry preserves
-- existing report history while providing a unique row that serializes new
-- submissions from concurrent users.
create table public.maintenance_active_issues (
  court_id text not null references public.courts(id),
  category public.maintenance_category not null,
  report_id uuid not null unique references public.maintenance_reports(id),
  created_at timestamptz not null default now(),
  primary key (court_id, category)
);

insert into public.maintenance_active_issues(court_id, category, report_id, created_at)
select distinct on (report.court_id, report.category)
  report.court_id, report.category, report.id, report.created_at
from public.maintenance_reports report
where report.status <> 'RESOLVED'
order by report.court_id, report.category, report.created_at desc, report.id desc;

alter table public.maintenance_active_issues enable row level security;
revoke all on public.maintenance_active_issues from public, anon, authenticated;

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
  v_replacement_id uuid;
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

  if v_report.status = 'RESOLVED' and p_status <> 'RESOLVED' then
    begin
      insert into public.maintenance_active_issues(court_id, category, report_id)
      values (v_report.court_id, v_report.category, v_report.id);
    exception when unique_violation then
      raise exception using errcode = '23505', message = 'DUPLICATE_ACTIVE_REPORT';
    end;
  end if;

  update public.maintenance_reports
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      updated_at = now()
  where id = p_report_id
  returning * into v_report;

  if p_status = 'RESOLVED' then
    select report.id into v_replacement_id
    from public.maintenance_reports report
    where report.court_id = v_report.court_id
      and report.category = v_report.category
      and report.status <> 'RESOLVED'
      and report.id <> v_report.id
    order by report.created_at desc, report.id desc
    limit 1;

    update public.maintenance_active_issues
    set report_id = v_replacement_id,
        created_at = now()
    where court_id = v_report.court_id
      and category = v_report.category
      and report_id = v_report.id
      and v_replacement_id is not null;

    delete from public.maintenance_active_issues
    where court_id = v_report.court_id
      and category = v_report.category
      and report_id = v_report.id
      and v_replacement_id is null;
  end if;

  return v_report;
end;
$$;

-- Only reports accepted by an admin are shown to other users. NEW reports
-- remain visible only to their reporter and administrators.
create or replace function public.list_public_maintenance_status()
returns table(
  id uuid,
  court_id text,
  category public.maintenance_category,
  details text,
  status public.maintenance_status,
  admin_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select report.id, report.court_id, report.category, report.details,
    report.status, report.admin_note, report.created_at, report.updated_at
  from public.maintenance_reports report
  where report.status in ('IN_PROGRESS', 'WAITING_FOR_CARETAKER')
  order by report.updated_at desc, report.id desc
  limit 50;
$$;

revoke insert, update, delete on public.maintenance_reports from anon, authenticated;
revoke execute on function public.create_maintenance_report(text, public.maintenance_category, text, text) from public, anon;
grant execute on function public.create_maintenance_report(text, public.maintenance_category, text, text) to authenticated;
revoke execute on function public.admin_update_maintenance_status(uuid, public.maintenance_status, text) from public, anon;
grant execute on function public.admin_update_maintenance_status(uuid, public.maintenance_status, text) to authenticated;
revoke execute on function public.list_public_maintenance_status() from public, anon;
grant execute on function public.list_public_maintenance_status() to authenticated;
