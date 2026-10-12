-- Winner rotation, automatic queue advance, and score resubmission after
-- INVALID_SCORE.
begin;
select plan(14);

create temporary table obs(key text primary key, val text) on commit drop;

do $$
declare
  admin_id uuid := '2b000000-0000-0000-0000-000000000099';
  outsider uuid := '2b000000-0000-0000-0000-000000000098';
  cap uuid[] := array[
    '2b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000002',
    '2b000000-0000-0000-0000-000000000003', '2b000000-0000-0000-0000-000000000004']::uuid[];
  mem uuid[] := array[
    '2b000000-0000-0000-0000-000000000011', '2b000000-0000-0000-0000-000000000012',
    '2b000000-0000-0000-0000-000000000013', '2b000000-0000-0000-0000-000000000014']::uuid[];
  team uuid[] := array[]::uuid[];
  t_a uuid; t_b uuid; t_c uuid; t_d uuid;
  g1 uuid; g2 uuid; g3 uuid; g4 uuid;
  v_id uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rot-' || id || '@meq.test', '', now(), now(),
    jsonb_build_object('display_name', 'Rotation')
  from unnest(cap || mem || array[admin_id, outsider]) id;
  update public.profiles set role = 'ADMIN' where id = admin_id;
  -- Keep the court open whatever time the test runs.
  update public.courts set is_open = true, opens_at = '00:00' where id in ('3x3-a', '5x5');

  for i in 1..4 loop
    insert into public.teams(name, format, captain_user_id) values ('Rotation ' || chr(64 + i), 'THREE_X_THREE', cap[i])
      returning id into v_id;
    team := team || v_id;
    insert into public.team_memberships(team_id, user_id, role) values (v_id, cap[i], 'CAPTAIN'), (v_id, mem[i], 'MEMBER');
  end loop;
  t_a := team[1]; t_b := team[2]; t_c := team[3]; t_d := team[4];
  insert into public.location_verifications(user_id, court_id, distance_metres, expires_at, provider)
  select id, '3x3-a', 10, now() + interval '30 minutes', 'DEVELOPMENT' from unnest(cap || mem) id;

  -- Game 1: A beats B while C and D wait.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-a', t_a, 'PLAYING'), ('3x3-a', t_b, 'PLAYING');
  insert into public.queue_entries(court_id, team_id, status, position, joined_at) values
    ('3x3-a', t_c, 'WAITING', 1, now() - interval '2 minutes'), ('3x3-a', t_d, 'WAITING', 2, now() - interval '1 minute');
  insert into public.games(court_id, team_a_id, team_b_id, target_score) values ('3x3-a', t_a, t_b, 7) returning id into g1;
  update public.courts set active_game_id = g1 where id = '3x3-a';
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain) values
    (g1, t_a, cap[1], 'A', true), (g1, t_a, mem[1], 'A2', false), (g1, t_b, cap[2], 'B', true), (g1, t_b, mem[2], 'B2', false);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_resolve_game(g1, 7, 3);
  insert into obs select 'winner_deadline', (decision_deadline between now() + interval '170 seconds' and now() + interval '190 seconds')::text
    from public.queue_entries where team_id = t_a and status = 'DECIDING_CONTINUE';
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.decide_loser_requeue(g1, true);

  -- The cron calls only one challenger while the winner decides.
  perform private.expire_all_queue_timeouts();
  insert into obs select 'called_while_deciding', string_agg(t.name, ',' order by t.name)
    from public.queue_entries q join public.teams t on t.id = q.team_id where q.court_id = '3x3-a' and q.status = 'CALLED';

  -- A stays; its roster is locked while it holds the court.
  perform set_config('request.jwt.claim.sub', cap[1]::text, true);
  perform public.decide_winner_continuation(g1, true);
  begin
    perform public.invite_team_member(t_a, outsider);
    insert into obs values ('holder_invite', 'allowed');
  exception when check_violation then
    insert into obs values ('holder_invite', sqlerrm);
  end;

  -- C confirms ready and plays A straight away.
  perform set_config('request.jwt.claim.sub', cap[3]::text, true);
  perform public.confirm_team_ready((select id from public.team_check_ins where team_id = t_c and status = 'ACTIVE'));
  select id into g2 from public.games where court_id = '3x3-a' and status = 'PLAYING';
  insert into obs select 'game2_teams', (select string_agg(t.name, ',' order by t.name) from public.teams t where t.id in (g.team_a_id, g.team_b_id))
    from public.games g where g.id = g2;

  -- Second win in a row: A rests. B and D play the rest game.
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_resolve_game(g2, 7, 2);
  insert into obs select 'after_second_win', status::text from public.queue_entries where team_id = t_a and court_id = '3x3-a' order by joined_at desc limit 1;
  perform private.expire_all_queue_timeouts();
  insert into obs select 'called_for_rest_game', string_agg(t.name, ',' order by t.name)
    from public.queue_entries q join public.teams t on t.id = q.team_id where q.court_id = '3x3-a' and q.status = 'CALLED';
  perform set_config('request.jwt.claim.sub', cap[4]::text, true);
  perform public.confirm_team_ready((select id from public.team_check_ins where team_id = t_d and status = 'ACTIVE'));
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.confirm_team_ready((select id from public.team_check_ins where team_id = t_b and status = 'ACTIVE'));
  select id into g3 from public.games where court_id = '3x3-a' and status = 'PLAYING';
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_resolve_game(g3, case when (select team_a_id from public.games where id = g3) = t_d then 7 else 2 end,
    case when (select team_a_id from public.games where id = g3) = t_d then 2 else 7 end);
  insert into obs select 'rested_team_returns', status::text || ':' || coalesce(position::text, '-')
    from public.queue_entries where team_id = t_a and court_id = '3x3-a' order by joined_at desc limit 1;
  insert into obs select 'rested_streak', consecutive_wins::text from public.teams where id = t_a;

  -- D (winner of the rest game) never decides and times out.
  update public.queue_entries set decision_deadline = now() - interval '1 second'
  where team_id = t_d and status = 'DECIDING_CONTINUE';
  perform private.expire_all_queue_timeouts();
  insert into obs select 'winner_timeout', status::text from public.queue_entries where team_id = t_d and court_id = '3x3-a' order by joined_at desc limit 1;
  insert into obs select 'winner_timeout_streak', consecutive_wins::text from public.teams where id = t_d;
  -- Only A is waiting, so nobody is called to wait alone.
  insert into obs select 'lonely_team', status::text from public.queue_entries where team_id = t_a and court_id = '3x3-a' order by joined_at desc limit 1;

  -- INVALID_SCORE: a 3-3 tie, then B alone raises its own score.
  insert into public.games(court_id, team_a_id, team_b_id, target_score) values ('5x5', t_b, t_c, 7) returning id into g4;
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain) values
    (g4, t_b, cap[2], 'B', true), (g4, t_b, mem[2], 'B2', false), (g4, t_c, cap[3], 'C', true), (g4, t_c, mem[3], 'C2', false);
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.request_game_end(g4);
  perform public.submit_team_scores(g4, jsonb_build_object(cap[2]::text, 2, mem[2]::text, 1));
  perform set_config('request.jwt.claim.sub', cap[3]::text, true);
  perform public.submit_team_scores(g4, jsonb_build_object(cap[3]::text, 2, mem[3]::text, 1));
  insert into obs select 'tie_status', status::text from public.games where id = g4;
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.submit_team_scores(g4, jsonb_build_object(cap[2]::text, 4, mem[2]::text, 3));
  insert into obs select 'one_sided_resubmit', status::text || ':' || coalesce(winner_team_id::text, 'none') from public.games where id = g4;
  perform set_config('request.jwt.claim.sub', cap[3]::text, true);
  perform public.submit_team_scores(g4, jsonb_build_object(cap[3]::text, 2, mem[3]::text, 1));
  insert into obs select 'both_resubmit', status::text || ':' || (winner_team_id = t_b)::text from public.games where id = g4;
end;
$$;

select is((select val from obs where key = 'winner_deadline'), 'true', 'winner gets 3 minutes to decide');
select is((select val from obs where key = 'called_while_deciding'), 'Rotation C', 'only one challenger is called while the winner decides');
select is((select val from obs where key = 'holder_invite'), 'ROSTER_LOCKED', 'holding team cannot change its roster');
select is((select val from obs where key = 'game2_teams'), 'Rotation A,Rotation C', 'holding winner plays the first ready challenger');
select is((select val from obs where key = 'after_second_win'), 'RESTING', 'second consecutive win rests the team');
select is((select val from obs where key = 'called_for_rest_game'), 'Rotation B,Rotation D', 'two challengers are called for the rest game');
select is((select val from obs where key = 'rested_team_returns'), 'WAITING:1', 'rested team returns to the head of the queue');
select is((select val from obs where key = 'rested_streak'), '0', 'rested team starts a new streak');
select is((select val from obs where key = 'winner_timeout'), 'LEFT_QUEUE', 'winner that does not decide leaves the queue');
select is((select val from obs where key = 'winner_timeout_streak'), '0', 'timed-out winner streak is reset');
select is((select val from obs where key = 'lonely_team'), 'WAITING', 'a single waiting team is not called alone');
select is((select val from obs where key = 'tie_status'), 'INVALID_SCORE', 'tie is invalid');
select is((select val from obs where key = 'one_sided_resubmit'), 'AWAITING_SCORE:none', 'one team cannot finalize after INVALID_SCORE alone');
select is((select val from obs where key = 'both_resubmit'), 'COMPLETED:true', 'game completes once both teams resubmit');

select * from finish();
rollback;
