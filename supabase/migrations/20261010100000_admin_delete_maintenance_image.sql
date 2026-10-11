-- Return the stored image path from admin_delete_maintenance_report so the
-- server deletes the evidence image named by the database, never a path sent
-- by the browser. Admins also need a storage delete policy, because the
-- original policy only lets users delete objects in their own folder.
drop function if exists public.admin_delete_maintenance_report(uuid);

create function public.admin_delete_maintenance_report(
  p_report_id uuid
)
returns text
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

  -- Hand the active-issue slot to the newest other unresolved report, if any,
  -- matching admin_update_maintenance_status when a report is resolved.
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
  where report_id = v_report.id
    and v_replacement_id is not null;

  delete from public.maintenance_active_issues
  where report_id = v_report.id;

  delete from public.maintenance_reports
  where id = v_report.id;

  return v_report.image_path;
end;
$$;

revoke execute on function public.admin_delete_maintenance_report(uuid) from public, anon;
grant execute on function public.admin_delete_maintenance_report(uuid) to authenticated;

create policy maintenance_delete_admin on storage.objects for delete to authenticated
using (bucket_id = 'maintenance-evidence' and private.is_admin());
