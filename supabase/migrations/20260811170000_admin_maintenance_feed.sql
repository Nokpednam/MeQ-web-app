-- Admin-only maintenance feed with server-side authorization.
create or replace function public.admin_list_maintenance_reports()
returns setof public.maintenance_reports
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  return query select report.* from public.maintenance_reports report order by report.created_at desc;
end;
$$;
revoke execute on function public.admin_list_maintenance_reports() from public, anon;
grant execute on function public.admin_list_maintenance_reports() to authenticated;
