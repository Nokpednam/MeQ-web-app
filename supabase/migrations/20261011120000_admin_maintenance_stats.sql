-- Maintenance statistics for the admin dashboard and the project report.
-- Response time: report created -> first admin status change.
-- Resolution time: report created -> first RESOLVED entry.
-- History rows backfilled for reports older than the history table use the
-- report's updated_at, so their times are approximate.
create or replace function public.admin_maintenance_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then
    raise exception using errcode = '22023', message = 'INVALID_PERIOD';
  end if;
  v_since := case when p_days is null then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;

  with reports as (
    select report.*
    from public.maintenance_reports report
    where report.created_at >= v_since
  ),
  timings as (
    select report.id,
      extract(epoch from (
        select min(history.changed_at) from public.maintenance_status_history history
        where history.report_id = report.id and history.from_status is not null
      ) - report.created_at) / 3600.0 as response_hours,
      extract(epoch from (
        select min(history.changed_at) from public.maintenance_status_history history
        where history.report_id = report.id and history.to_status = 'RESOLVED'
      ) - report.created_at) / 3600.0 as resolution_hours
    from reports report
  )
  select jsonb_build_object(
    'periodDays', p_days,
    'total', (select count(*) from reports),
    'open', (select count(*) from reports where status not in ('RESOLVED', 'REJECTED')),
    'byStatus', coalesce((
      select jsonb_object_agg(status, total)
      from (select status::text, count(*) as total from reports group by status) s
    ), '{}'::jsonb),
    'byCourt', coalesce((
      select jsonb_agg(jsonb_build_object('key', court_id, 'total', total) order by total desc, court_id)
      from (select court_id, count(*) as total from reports group by court_id) c
    ), '[]'::jsonb),
    'byCategory', coalesce((
      select jsonb_agg(jsonb_build_object('key', category, 'total', total) order by total desc, category)
      from (select category::text, count(*) as total from reports group by category) c
    ), '[]'::jsonb),
    'avgResponseHours', (select round(avg(response_hours)::numeric, 1) from timings where response_hours >= 0),
    'medianResponseHours', (
      select round((percentile_cont(0.5) within group (order by response_hours))::numeric, 1)
      from timings where response_hours >= 0
    ),
    'avgResolutionHours', (select round(avg(resolution_hours)::numeric, 1) from timings where resolution_hours >= 0),
    'medianResolutionHours', (
      select round((percentile_cont(0.5) within group (order by resolution_hours))::numeric, 1)
      from timings where resolution_hours >= 0
    ),
    'resolvedCount', (select count(*) from timings where resolution_hours >= 0),
    'oldestOpenHours', (
      select round((extract(epoch from now() - min(created_at)) / 3600.0)::numeric, 1)
      from reports where status not in ('RESOLVED', 'REJECTED')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_maintenance_stats(integer) from public, anon;
grant execute on function public.admin_maintenance_stats(integer) to authenticated;
