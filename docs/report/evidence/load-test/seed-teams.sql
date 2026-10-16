-- LOCAL load-test setup (run as postgres on the local stack only).
-- 10 teams of 3 (load01-30) and 4 teams of 5 (load31-50), all location-verified, courts open all day.
update public.courts set is_open = true, opens_at = '00:00';
update public.profiles p set onboarding_completed_at = now()
  from auth.users u where u.id = p.id and u.email like 'load%@meq.test';

do $$
declare
  v_ids uuid[];
  v_team public.teams;
  i int;
  j int;
begin
  select array_agg(id order by email) into v_ids from auth.users where email like 'load%@meq.test';
  -- 3x3 teams: captains load01, load04, ... load28
  for i in 0..9 loop
    perform set_config('request.jwt.claim.sub', v_ids[i*3+1]::text, true);
    v_team := public.create_team('Load 3x3 ' || (i+1), 'THREE_X_THREE');
    for j in 2..3 loop perform public.add_team_member(v_team.id, v_ids[i*3+j]); end loop;
  end loop;
  -- 5x5 teams: captains load31, load36, load41, load46
  for i in 0..3 loop
    perform set_config('request.jwt.claim.sub', v_ids[30+i*5+1]::text, true);
    v_team := public.create_team('Load 5x5 ' || (i+1), 'FIVE_X_FIVE');
    for j in 2..5 loop perform public.add_team_member(v_team.id, v_ids[30+i*5+j]); end loop;
  end loop;
end $$;

insert into public.location_verifications(user_id, court_id, distance_metres, expires_at, provider)
select u.id, c.id, 10, now() + interval '3 hours', 'DEVELOPMENT'
from auth.users u
join public.team_memberships tm on tm.user_id = u.id and tm.left_at is null
join public.teams t on t.id = tm.team_id
join public.courts c on (t.format = 'THREE_X_THREE' and c.required_members = 3)
                     or (t.format = 'FIVE_X_FIVE' and c.required_members = 5)
where u.email like 'load%@meq.test';

select t.format, count(distinct t.id) as teams, count(*) as members
from public.teams t join public.team_memberships tm on tm.team_id = t.id and tm.left_at is null
group by t.format;
select count(*) as verifications from public.location_verifications;
