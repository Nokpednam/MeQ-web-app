-- Authenticated users can read only reports owned by their current account.
create or replace function public.list_my_maintenance_reports()
returns setof public.maintenance_reports
language sql stable security definer set search_path = '' as $$
  select report.*
  from public.maintenance_reports report
  where report.reporter_user_id = (select auth.uid())
  order by report.created_at desc;
$$;
revoke execute on function public.list_my_maintenance_reports() from public, anon;
grant execute on function public.list_my_maintenance_reports() to authenticated;
