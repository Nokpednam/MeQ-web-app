-- Admin-only hard-delete for a maintenance report.
-- Removes the active-issue registry entry (if any) and the report row.
-- The caller is responsible for removing the stored image from the bucket.
create or replace function public.admin_delete_maintenance_report(
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_image_path text;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;

  -- Fetch image path so the caller can clean up storage.
  select image_path into v_image_path
  from public.maintenance_reports
  where id = p_report_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'REPORT_NOT_FOUND';
  end if;

  -- Remove from active-issues registry first (FK constraint).
  delete from public.maintenance_active_issues
  where report_id = p_report_id;

  -- Hard-delete the report.
  delete from public.maintenance_reports
  where id = p_report_id;
end;
$$;

revoke execute on function public.admin_delete_maintenance_report(uuid) from public, anon;
grant  execute on function public.admin_delete_maintenance_report(uuid) to authenticated;
