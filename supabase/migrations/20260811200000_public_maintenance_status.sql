-- Public maintenance status intentionally omits reporter identity and evidence.
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
language sql stable security definer set search_path = '' as $$
  select report.id, report.court_id, report.category, report.details,
    report.status, report.admin_note, report.created_at, report.updated_at
  from public.maintenance_reports report
  where report.status <> 'RESOLVED'
    or report.updated_at >= now() - interval '7 days'
  order by
    case report.status when 'NEW' then 1 when 'IN_PROGRESS' then 2 else 3 end,
    report.updated_at desc
  limit 50;
$$;
revoke execute on function public.list_public_maintenance_status() from public, anon;
grant execute on function public.list_public_maintenance_status() to authenticated;
