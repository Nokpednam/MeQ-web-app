-- Expose only queue-readiness metadata for members of the caller's own team.
-- Coordinates, accuracy, distance, and provider remain private to each user.

create or replace function public.get_team_location_status(p_court_id text)
returns table(
  user_id uuid,
  display_name text,
  is_current_user boolean,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_team_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.courts where id = p_court_id) then
    raise exception using errcode = 'P0002', message = 'COURT_NOT_FOUND';
  end if;

  select tm.team_id into v_team_id
  from public.team_memberships tm
  join public.teams t on t.id = tm.team_id and t.dissolved_at is null
  where tm.user_id = v_user_id and tm.left_at is null;

  if v_team_id is null then return; end if;

  return query
  select
    tm.user_id,
    p.display_name,
    tm.user_id = v_user_id,
    case
      when latest.expires_at is null then 'MISSING'
      when latest.expires_at <= now() then 'EXPIRED'
      else 'VERIFIED'
    end,
    latest.expires_at
  from public.team_memberships tm
  join public.profiles p on p.id = tm.user_id
  left join lateral (
    select lv.expires_at
    from public.location_verifications lv
    where lv.user_id = tm.user_id and lv.court_id = p_court_id
    order by lv.expires_at desc
    limit 1
  ) latest on true
  where tm.team_id = v_team_id and tm.left_at is null
  order by (tm.user_id = v_user_id) desc, tm.joined_at, tm.user_id;
end;
$$;

revoke execute on function public.get_team_location_status(text) from public, anon;
grant execute on function public.get_team_location_status(text) to authenticated;

