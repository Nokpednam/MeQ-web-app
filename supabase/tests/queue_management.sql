begin;
select plan(1);

do $$
declare
  a1 uuid := '20000000-0000-0000-0000-000000000001';
  a2 uuid := '20000000-0000-0000-0000-000000000002';
  a3 uuid := '20000000-0000-0000-0000-000000000003';
  b1 uuid := '20000000-0000-0000-0000-000000000004';
  b2 uuid := '20000000-0000-0000-0000-000000000005';
  b3 uuid := '20000000-0000-0000-0000-000000000006';
  short1 uuid := '20000000-0000-0000-0000-000000000007';
  team_a public.teams;
  team_b public.teams;
  short_team public.teams;
  entry_a public.queue_entries;
  entry_b public.queue_entries;
  current_position bigint;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', id::text || '@queue.meq.test', '', now(), now(), jsonb_build_object('display_name', 'Queue QA')
  from unnest(array[a1,a2,a3,b1,b2,b3,short1]) id;

  perform set_config('request.jwt.claim.sub', a1::text, true);
  team_a := public.create_team('Queue Alpha', 'THREE_X_THREE');
  perform public.add_team_member(team_a.id, a2);
  perform public.add_team_member(team_a.id, a3);

  perform set_config('request.jwt.claim.sub', b1::text, true);
  team_b := public.create_team('Queue Beta', 'THREE_X_THREE');
  perform public.add_team_member(team_b.id, b2);
  perform public.add_team_member(team_b.id, b3);

  perform set_config('request.jwt.claim.sub', short1::text, true);
  short_team := public.create_team('Short Team', 'THREE_X_THREE');

  insert into public.location_verifications(user_id, court_id, distance_metres, expires_at, provider)
  select id, court_id, 10, now() + interval '10 minutes', 'DEVELOPMENT'
  from unnest(array[a1,a2,a3,b1,b2,b3,short1]) id
  cross join unnest(array['3x3-a','3x3-b','5x5']) court_id;

  perform set_config('request.jwt.claim.sub', short1::text, true);
  begin
    perform public.join_court_queue('3x3-a');
    raise exception 'incomplete team joined queue';
  exception when check_violation then
    if sqlerrm <> 'TEAM_INCOMPLETE' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', a1::text, true);
  begin
    perform public.join_court_queue('5x5');
    raise exception '3x3 team joined 5x5 court';
  exception when check_violation then
    if sqlerrm <> 'INCOMPATIBLE_COURT' then raise; end if;
  end;

  entry_a := public.join_court_queue('3x3-a');
  if entry_a.position <> 1 or entry_a.status <> 'WAITING' then raise exception 'first queue position invalid'; end if;
  if (select count(*) from public.active_queue_players where queue_entry_id = entry_a.id) <> 3 then raise exception 'active players were not reserved'; end if;

  begin
    perform public.join_court_queue('3x3-b');
    raise exception 'team joined two courts';
  exception when unique_violation then
    null;
  end;

  perform set_config('request.jwt.claim.sub', b1::text, true);
  entry_b := public.join_court_queue('3x3-a');
  if entry_b.position <> 2 then raise exception 'second queue position invalid'; end if;

  perform set_config('request.jwt.claim.sub', b2::text, true);
  begin
    perform public.leave_court_queue(entry_b.id);
    raise exception 'non-captain left queue';
  exception when insufficient_privilege then
    if sqlerrm <> 'CAPTAIN_ONLY' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', a1::text, true);
  perform public.leave_court_queue(entry_a.id);
  select position into current_position from public.queue_entries where id = entry_b.id;
  if current_position <> 1 then raise exception 'queue positions were not reordered'; end if;
  if exists (select 1 from public.active_queue_players where queue_entry_id = entry_a.id) then raise exception 'active player reservation was not released'; end if;

  raise notice 'QUEUE_MANAGEMENT_TESTS_PASSED';
end;
$$;

select pass('queue management flow completed');
select * from finish();

rollback;
