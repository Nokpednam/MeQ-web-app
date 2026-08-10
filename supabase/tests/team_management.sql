begin;

do $$
declare
  captain_id uuid := '10000000-0000-0000-0000-000000000001';
  member_a_id uuid := '10000000-0000-0000-0000-000000000002';
  member_b_id uuid := '10000000-0000-0000-0000-000000000003';
  extra_id uuid := '10000000-0000-0000-0000-000000000004';
  team_row public.teams;
  other_team public.teams;
  active_count integer;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  values
    (captain_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'captain@meq.test', '', now(), now(), '{"display_name":"Captain QA"}'),
    (member_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-a@meq.test', '', now(), now(), '{"display_name":"Member A"}'),
    (member_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-b@meq.test', '', now(), now(), '{"display_name":"Member B"}'),
    (extra_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'extra@meq.test', '', now(), now(), '{"display_name":"Extra QA"}');

  perform set_config('request.jwt.claim.sub', captain_id::text, true);
  team_row := public.create_team('  QA   Three  ', 'THREE_X_THREE');
  if team_row.name <> 'QA Three' then raise exception 'name normalization failed'; end if;
  select count(*) into active_count from public.team_memberships where team_id = team_row.id and left_at is null and role = 'CAPTAIN';
  if active_count <> 1 then raise exception 'creator was not made the sole captain'; end if;

  begin
    perform public.create_team('Second Team', 'THREE_X_THREE');
    raise exception 'one-team rule was not enforced';
  exception when unique_violation then
    if sqlerrm <> 'USER_ALREADY_IN_TEAM' then raise; end if;
  end;

  perform public.add_team_member(team_row.id, member_a_id);
  perform public.add_team_member(team_row.id, member_b_id);
  select count(*) into active_count from public.team_memberships where team_id = team_row.id and left_at is null;
  if active_count <> 3 then raise exception '3x3 roster did not reach three members'; end if;

  begin
    perform public.add_team_member(team_row.id, extra_id);
    raise exception '3x3 capacity was not enforced';
  exception when check_violation then
    if sqlerrm <> 'TEAM_FULL' then raise; end if;
  end;

  begin
    perform public.remove_team_member(team_row.id, captain_id);
    raise exception 'captain self-removal was not blocked';
  exception when check_violation then
    if sqlerrm <> 'CAPTAIN_CANNOT_REMOVE_SELF' then raise; end if;
  end;

  perform public.transfer_team_captain(team_row.id, member_a_id);
  perform set_config('request.jwt.claim.sub', captain_id::text, true);
  perform public.leave_team(team_row.id);
  if exists (select 1 from public.team_memberships where team_id = team_row.id and user_id = captain_id and left_at is null) then
    raise exception 'former captain did not leave';
  end if;

  perform set_config('request.jwt.claim.sub', extra_id::text, true);
  other_team := public.create_team('Other QA', 'FIVE_X_FIVE');
  begin
    perform public.add_team_member(other_team.id, member_b_id);
    raise exception 'one active membership rule was not enforced';
  exception when unique_violation then
    if sqlerrm <> 'USER_ALREADY_IN_TEAM' then raise; end if;
  end;

  raise notice 'TEAM_MANAGEMENT_TESTS_PASSED';
end;
$$;

rollback;
