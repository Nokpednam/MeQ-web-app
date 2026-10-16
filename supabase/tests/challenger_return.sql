-- A challenger called to play a deciding winner goes back to the head of the
-- queue when the winner leaves or lets the decision time out and nobody else
-- waits. Found in the field test of 16 Oct 2026: the challenger was left
-- checking in for a game that could not start and was dropped as MISSED_QUEUE.
begin;
select plan(8);

create temporary table obs(key text primary key, val text) on commit drop;

do $$
declare
  admin_id uuid := '43000000-0000-0000-0000-000000000099';
  cap uuid[] := array[
    '43000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000003', '43000000-0000-0000-0000-000000000004']::uuid[];
  mem uuid[] := array[
    '43000000-0000-0000-0000-000000000011', '43000000-0000-0000-0000-000000000012',
    '43000000-0000-0000-0000-000000000013', '43000000-0000-0000-0000-000000000014']::uuid[];
  team uuid[] := array[]::uuid[];
  v_id uuid;
  g1 uuid;
  g2 uuid;
  courts text[] := array['3x3-a', '3x3-a', '3x3-b', '3x3-b'];
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ret-' || id || '@meq.test', '', now(), now(),
    jsonb_build_object('display_name', 'Return')
  from unnest(cap || mem || array[admin_id]) id;
  update public.profiles set role = 'ADMIN' where id = admin_id;
  update public.courts set is_open = true, opens_at = '00:00' where id in ('3x3-a', '3x3-b');

  for i in 1..4 loop
    insert into public.teams(name, format, captain_user_id) values ('Return ' || chr(64 + i), 'THREE_X_THREE', cap[i])
      returning id into v_id;
    team := team || v_id;
    insert into public.team_memberships(team_id, user_id, role) values (v_id, cap[i], 'CAPTAIN'), (v_id, mem[i], 'MEMBER');
    insert into public.location_verifications(user_id, court_id, distance_metres, expires_at, provider)
    select id, courts[i], 10, now() + interval '30 minutes', 'DEVELOPMENT' from unnest(array[cap[i], mem[i]]) id;
  end loop;

  -- Court 3x3-a: A beats B, only these two teams. B requeues and is called to face A.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-a', team[1], 'PLAYING'), ('3x3-a', team[2], 'PLAYING');
  insert into public.games(court_id, team_a_id, team_b_id, target_score) values ('3x3-a', team[1], team[2], 7) returning id into g1;
  update public.courts set active_game_id = g1 where id = '3x3-a';
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain) values
    (g1, team[1], cap[1], 'A', true), (g1, team[1], mem[1], 'A2', false), (g1, team[2], cap[2], 'B', true), (g1, team[2], mem[2], 'B2', false);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_resolve_game(g1, 7, 6);
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.decide_loser_requeue(g1, true);
  perform private.expire_all_queue_timeouts();
  insert into obs select 'a_challenger_called', q.status::text from public.queue_entries q
    where q.team_id = team[2] and q.court_id = '3x3-a' and q.closed_at is null;

  -- The winner lets the decision time out.
  update public.queue_entries set decision_deadline = now() - interval '1 second'
    where team_id = team[1] and status = 'DECIDING_CONTINUE';
  perform private.expire_all_queue_timeouts();
  insert into obs select 'a_after_timeout', q.status::text || ':' || coalesce(q.position::text, 'null')
    from public.queue_entries q where q.team_id = team[2] and q.court_id = '3x3-a' and q.closed_at is null;
  insert into obs select 'a_check_in_open', count(*)::text from public.team_check_ins
    where court_id = '3x3-a' and status in ('ACTIVE', 'READY');
  -- Even after the check-in deadline would have passed, B stays in the queue.
  update public.team_check_ins set deadline = now() - interval '1 second' where court_id = '3x3-a';
  perform private.expire_all_queue_timeouts();
  insert into obs select 'a_later', q.status::text from public.queue_entries q
    where q.team_id = team[2] and q.court_id = '3x3-a' order by q.joined_at desc limit 1;

  -- Court 3x3-b: C beats D, D requeues and is called, then C chooses to leave.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-b', team[3], 'PLAYING'), ('3x3-b', team[4], 'PLAYING');
  insert into public.games(court_id, team_a_id, team_b_id, target_score) values ('3x3-b', team[3], team[4], 7) returning id into g2;
  update public.courts set active_game_id = g2 where id = '3x3-b';
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain) values
    (g2, team[3], cap[3], 'C', true), (g2, team[3], mem[3], 'C2', false), (g2, team[4], cap[4], 'D', true), (g2, team[4], mem[4], 'D2', false);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_resolve_game(g2, 7, 2);
  perform set_config('request.jwt.claim.sub', cap[4]::text, true);
  perform public.decide_loser_requeue(g2, true);
  perform private.expire_all_queue_timeouts();
  insert into obs select 'b_challenger_called', q.status::text from public.queue_entries q
    where q.team_id = team[4] and q.court_id = '3x3-b' and q.closed_at is null;
  perform set_config('request.jwt.claim.sub', cap[3]::text, true);
  perform public.decide_winner_continuation(g2, false);
  insert into obs select 'b_after_leave', q.status::text || ':' || coalesce(q.position::text, 'null')
    from public.queue_entries q where q.team_id = team[4] and q.court_id = '3x3-b' and q.closed_at is null;
  insert into obs select 'b_check_in_open', count(*)::text from public.team_check_ins
    where court_id = '3x3-b' and status in ('ACTIVE', 'READY');
end;
$$;

select is((select val from obs where key = 'a_challenger_called'), 'CALLED', 'the requeued loser is called while the winner decides');
select is((select val from obs where key = 'a_after_timeout'), 'WAITING:1', 'after the winner times out, the challenger returns to the head of the queue');
select is((select val from obs where key = 'a_check_in_open'), '0', 'the challenger''s check-in is closed');
select is((select val from obs where key = 'a_later'), 'WAITING', 'the challenger is not dropped as missed later');
select is((select val from obs where key = 'b_challenger_called'), 'CALLED', 'the requeued loser is called on the second court');
select is((select val from obs where key = 'b_after_leave'), 'WAITING:1', 'after the winner leaves, the challenger returns to the head of the queue');
select is((select val from obs where key = 'b_check_in_open'), '0', 'the challenger''s check-in is closed after the winner leaves');
select ok(not exists (select 1 from public.queue_entries where status = 'MISSED_QUEUE' and court_id in ('3x3-a', '3x3-b')),
  'no team is marked as missed');

select * from finish();
rollback;
