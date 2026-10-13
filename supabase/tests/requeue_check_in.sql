-- A team that checked in, lost, and requeued keeps the same queue entry, so
-- it must be callable for a second check-in on that entry. Also covers a
-- holding winner leaving while a challenger is checking in.
begin;
select plan(9);

create temporary table obs(key text primary key, val text) on commit drop;

do $$
declare
  admin_id uuid := '2c000000-0000-0000-0000-000000000099';
  cap uuid[] := array[
    '2c000000-0000-0000-0000-000000000001', '2c000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000003',
    '2c000000-0000-0000-0000-000000000004', '2c000000-0000-0000-0000-000000000005', '2c000000-0000-0000-0000-000000000006']::uuid[];
  mem uuid[] := array[
    '2c000000-0000-0000-0000-000000000011', '2c000000-0000-0000-0000-000000000012', '2c000000-0000-0000-0000-000000000013',
    '2c000000-0000-0000-0000-000000000014', '2c000000-0000-0000-0000-000000000015', '2c000000-0000-0000-0000-000000000016']::uuid[];
  team uuid[] := array[]::uuid[];
  t_a uuid; t_b uuid; t_c uuid; t_d uuid; t_e uuid; t_f uuid;
  g1 uuid;
  v_next_before integer;
  v_id uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rq-' || id || '@meq.test', '', now(), now(),
    jsonb_build_object('display_name', 'Requeue')
  from unnest(cap || mem || array[admin_id]) id;
  update public.profiles set role = 'ADMIN' where id = admin_id;
  update public.courts set is_open = true, opens_at = '00:00' where id in ('3x3-a', '3x3-b');

  for i in 1..6 loop
    insert into public.teams(name, format, captain_user_id) values ('Requeue ' || chr(64 + i), 'THREE_X_THREE', cap[i])
      returning id into v_id;
    team := team || v_id;
    insert into public.team_memberships(team_id, user_id, role) values (v_id, cap[i], 'CAPTAIN'), (v_id, mem[i], 'MEMBER');
  end loop;
  t_a := team[1]; t_b := team[2]; t_c := team[3]; t_d := team[4]; t_e := team[5]; t_f := team[6];
  insert into public.location_verifications(user_id, court_id, distance_metres, expires_at, provider)
  select id, '3x3-a', 10, now() + interval '30 minutes', 'DEVELOPMENT' from unnest(cap || mem) id;

  -- Both teams are called, check in, and play.
  insert into public.queue_entries(court_id, team_id, status, position, joined_at) values
    ('3x3-a', t_a, 'WAITING', 1, now() - interval '2 minutes'), ('3x3-a', t_b, 'WAITING', 2, now() - interval '1 minute');
  perform private.expire_all_queue_timeouts();
  perform set_config('request.jwt.claim.sub', cap[1]::text, true);
  perform public.confirm_team_ready((select id from public.team_check_ins where team_id = t_a and status = 'ACTIVE'));
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.confirm_team_ready((select id from public.team_check_ins where team_id = t_b and status = 'ACTIVE'));
  select id into g1 from public.games where court_id = '3x3-a' and status = 'PLAYING';
  insert into obs values ('first_game_started', (g1 is not null)::text);

  -- A wins and stays; B requeues on the same entry.
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_resolve_game(g1, case when (select team_a_id from public.games where id = g1) = t_a then 7 else 2 end,
    case when (select team_a_id from public.games where id = g1) = t_a then 2 else 7 end);
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.decide_loser_requeue(g1, true);
  perform set_config('request.jwt.claim.sub', cap[1]::text, true);
  perform public.decide_winner_continuation(g1, true);

  begin
    perform private.expire_all_queue_timeouts();
    insert into obs values ('second_call', 'ok');
  exception when unique_violation then
    insert into obs values ('second_call', sqlerrm);
  end;
  insert into obs select 'requeued_status', status::text || ':' ||
    (select count(*) from public.team_check_ins c where c.queue_entry_id = q.id and c.status = 'ACTIVE')::text
    from public.queue_entries q where team_id = t_b and court_id = '3x3-a' order by joined_at desc limit 1;
  select count(*) into v_next_before from public.line_notifications where kind = 'QUEUE_NEXT' and recipient_user_id = cap[2];

  -- The holding winner leaves while B checks in and nobody else waits.
  perform set_config('request.jwt.claim.sub', cap[1]::text, true);
  perform public.leave_court_queue((select id from public.queue_entries
    where team_id = t_a and court_id = '3x3-a' and status = 'HOLDING_COURT'));
  insert into obs select 'holder_left', status::text || ':' || (select consecutive_wins from public.teams where id = t_a)::text
    from public.queue_entries where team_id = t_a and court_id = '3x3-a' order by joined_at desc limit 1;
  insert into obs select 'holder_players_released', (count(*) = 0)::text
    from public.active_queue_players where user_id = any(array[cap[1], mem[1]]);
  -- B goes back to the head of the queue instead of timing out.
  insert into obs select 'challenger_returned', status::text || ':' || coalesce(position::text, '-') || ':' ||
    (select count(*) from public.team_check_ins c where c.queue_entry_id = q.id and c.status in ('ACTIVE', 'READY'))::text
    from public.queue_entries q where team_id = t_b and court_id = '3x3-a' order by joined_at desc limit 1;
  insert into obs select 'challenger_told_again', (count(*) = v_next_before + 1)::text
    from public.line_notifications where kind = 'QUEUE_NEXT' and recipient_user_id = cap[2];

  -- A new team arrives: B and the new team are called together.
  insert into public.queue_entries(court_id, team_id, status, position, joined_at) values ('3x3-a', t_c, 'WAITING', 2, now());
  perform private.expire_all_queue_timeouts();
  insert into obs select 'called_with_new_team', string_agg(t.name, ',' order by t.name)
    from public.queue_entries q join public.teams t on t.id = q.team_id where q.court_id = '3x3-a' and q.status = 'CALLED';

  -- On 3x3-b another team waits, so the called challenger keeps its check-in.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-b', t_d, 'HOLDING_COURT');
  insert into public.queue_entries(court_id, team_id, status, called_at, check_in_deadline)
    values ('3x3-b', t_e, 'CALLED', now(), now() + interval '3 minutes') returning id into v_id;
  insert into public.team_check_ins(queue_entry_id, team_id, court_id, deadline) values (v_id, t_e, '3x3-b', now() + interval '3 minutes');
  insert into public.queue_entries(court_id, team_id, status, position, joined_at) values ('3x3-b', t_f, 'WAITING', 1, now());
  perform set_config('request.jwt.claim.sub', cap[4]::text, true);
  perform public.leave_court_queue((select id from public.queue_entries where team_id = t_d and status = 'HOLDING_COURT'));
  insert into obs select 'challenger_kept', status::text || ':' ||
    (select count(*) from public.team_check_ins c where c.queue_entry_id = q.id and c.status = 'ACTIVE')::text
    from public.queue_entries q where team_id = t_e and court_id = '3x3-b';
end;
$$;

select is((select val from obs where key = 'first_game_started'), 'true', 'first game starts after both teams check in');
select is((select val from obs where key = 'second_call'), 'ok', 'calling a requeued team does not violate check-in uniqueness');
select is((select val from obs where key = 'requeued_status'), 'CALLED:1', 'requeued loser is called with one active check-in');

select is((select val from obs where key = 'holder_left'), 'LEFT_QUEUE:0', 'holding winner can leave the queue and its streak resets');
select is((select val from obs where key = 'holder_players_released'), 'true', 'leaving releases the holding players');
select is((select val from obs where key = 'challenger_returned'), 'WAITING:1:0', 'called challenger returns to the head of the queue when nobody else waits');
select is((select val from obs where key = 'challenger_told_again'), 'true', 'returned challenger is told again that it is next');
select is((select val from obs where key = 'called_with_new_team'), 'Requeue B,Requeue C', 'returned challenger is called with the next team that joins');
select is((select val from obs where key = 'challenger_kept'), 'CALLED:1', 'called challenger keeps its check-in when another team waits');

select * from finish();
rollback;
