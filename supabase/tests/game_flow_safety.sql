begin;
select plan(1);

do $$
declare
  captain_a uuid := '1a000000-0000-0000-0000-000000000001';
  delegate_a uuid := '1a000000-0000-0000-0000-000000000002';
  member_a uuid := '1a000000-0000-0000-0000-000000000003';
  captain_b uuid := '1a000000-0000-0000-0000-000000000004';
  member_b uuid := '1a000000-0000-0000-0000-000000000005';
  outsider uuid := '1a000000-0000-0000-0000-000000000006';
  admin_id uuid := '1a000000-0000-0000-0000-000000000007';
  team_a uuid;
  team_b uuid;
  game public.games;
  g_id uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'flow-' || id || '@meq.test', '', now(), now(),
    jsonb_build_object('display_name', name)
  from (values (captain_a, 'Captain A'), (delegate_a, 'Delegate A'), (member_a, 'Member A'),
               (captain_b, 'Captain B'), (member_b, 'Member B'), (outsider, 'Outsider'), (admin_id, 'Flow Admin')) as u(id, name);
  update public.profiles set role = 'ADMIN' where id = admin_id;

  insert into public.teams(name, format, captain_user_id) values ('ทีมเอฟโฟลว์', 'THREE_X_THREE', captain_a) returning id into team_a;
  insert into public.teams(name, format, captain_user_id) values ('ทีมบีโฟลว์', 'THREE_X_THREE', captain_b) returning id into team_b;
  insert into public.team_memberships(team_id, user_id, role) values
    (team_a, captain_a, 'CAPTAIN'), (team_a, delegate_a, 'MEMBER'), (team_a, member_a, 'MEMBER'),
    (team_b, captain_b, 'CAPTAIN'), (team_b, member_b, 'MEMBER');

  -- Only the captain can name a delegate, and only a current member.
  perform set_config('request.jwt.claim.sub', delegate_a::text, true);
  begin
    perform public.set_team_game_delegate(team_a, delegate_a);
    raise exception 'non-captain set a delegate';
  exception when insufficient_privilege then
    if sqlerrm <> 'CAPTAIN_ONLY' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', captain_a::text, true);
  begin
    perform public.set_team_game_delegate(team_a, outsider);
    raise exception 'outsider became a delegate';
  exception when check_violation then
    if sqlerrm <> 'NOT_TEAM_MEMBER' then raise; end if;
  end;
  perform public.set_team_game_delegate(team_a, delegate_a);

  -- A game in progress between the two teams.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-a', team_a, 'PLAYING'), ('3x3-a', team_b, 'PLAYING');
  insert into public.games(court_id, team_a_id, team_b_id, target_score) values ('3x3-a', team_a, team_b, 7) returning id into g_id;
  update public.courts set active_game_id = g_id where id = '3x3-a';
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain) values
    (g_id, team_a, captain_a, 'Captain A', true), (g_id, team_a, delegate_a, 'Delegate A', false), (g_id, team_a, member_a, 'Member A', false),
    (g_id, team_b, captain_b, 'Captain B', true), (g_id, team_b, member_b, 'Member B', false);

  -- The delegate can run the game but not manage the team.
  perform set_config('request.jwt.claim.sub', delegate_a::text, true);
  begin
    perform public.invite_team_member(team_a, outsider);
    raise exception 'delegate managed the team';
  exception when insufficient_privilege then
    if sqlerrm <> 'CAPTAIN_ONLY' then raise; end if;
  end;
  game := public.request_game_end(g_id);
  if game.status <> 'END_REQUESTED' or game.score_deadline is null
    or game.score_deadline < now() + interval '290 seconds' or game.score_deadline > now() + interval '310 seconds' then
    raise exception 'end request should set a five-minute score deadline, got %', game.score_deadline;
  end if;
  if (select count(*) from public.line_notifications where kind = 'SCORE_REQUEST') <> 3 then
    raise exception 'both captains and the delegate should be asked for scores';
  end if;

  -- After the deadline nobody can submit, and the timeout job frees the court.
  update public.games set score_deadline = now() - interval '1 second' where id = g_id;
  perform set_config('request.jwt.claim.sub', captain_b::text, true);
  begin
    perform public.submit_team_scores(g_id, jsonb_build_object(captain_b::text, 4, member_b::text, 3));
    raise exception 'scores accepted after the deadline';
  exception when check_violation then
    if sqlerrm <> 'SCORE_DEADLINE_PASSED' then raise; end if;
  end;
  perform private.expire_score_submissions();
  select * into game from public.games where id = g_id;
  if game.status <> 'CANCELLED' or game.invalid_reason <> 'SCORE_TIMEOUT' then
    raise exception 'timed-out game should be cancelled without result';
  end if;
  if (select active_game_id from public.courts where id = '3x3-a') is not null then
    raise exception 'court should be released';
  end if;
  if exists (select 1 from public.queue_entries where team_id in (team_a, team_b) and status = 'PLAYING') then
    raise exception 'both teams should leave the queue';
  end if;
  if exists (select 1 from public.player_game_history where game_id = game.id) then
    raise exception 'a cancelled game must not count in player history';
  end if;
  if (select count(*) from public.line_notifications where kind = 'GAME_CANCELLED') <> 5 then
    raise exception 'every rostered player should hear that the game has no result';
  end if;

  -- Admin decides a second game.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-a', team_a, 'PLAYING'), ('3x3-a', team_b, 'PLAYING');
  insert into public.games(court_id, team_a_id, team_b_id, target_score) values ('3x3-a', team_a, team_b, 7) returning id into g_id;
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain) values
    (g_id, team_a, captain_a, 'Captain A', true), (g_id, team_b, captain_b, 'Captain B', true);
  insert into public.player_scores(game_id, team_id, user_id, points) values (g_id, team_a, captain_a, 7);

  begin
    perform public.admin_resolve_game(g_id, 7, 3);
    raise exception 'non-admin resolved a game';
  exception when insufficient_privilege then
    if sqlerrm <> 'ADMIN_ONLY' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  begin
    perform public.admin_resolve_game(g_id, 5, 5);
    raise exception 'admin resolved a tie';
  exception when check_violation then
    if sqlerrm <> 'TIED_SCORE' then raise; end if;
  end;
  game := public.admin_resolve_game(g_id, 7, 3);
  if game.status <> 'COMPLETED' or game.winner_team_id <> team_a or game.final_team_a_score <> 7 then
    raise exception 'admin result was not applied';
  end if;
  if (select points from public.player_game_history where game_id = game.id and user_id = captain_b) <> 0
    or (select points from public.player_game_history where game_id = game.id and user_id = captain_a) <> 7 then
    raise exception 'history should keep submitted points and use 0 for missing ones';
  end if;
  if (select status from public.queue_entries where team_id = team_a and court_id = '3x3-a' and closed_at is null) <> 'DECIDING_CONTINUE' then
    raise exception 'winner should move to the post-game decision';
  end if;

  raise notice 'GAME_FLOW_SAFETY_TESTS_PASSED';
end;
$$;

select pass('score deadline, admin game resolution, and game delegate completed');
select * from finish();
rollback;
