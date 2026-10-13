-- A resting winner waits for the loser's decision, team-ready uses the same
-- distance as location verification, one failing court does not stop the
-- queue job for the others, and leaving a queue is audited.
begin;
select plan(8);

create temporary table obs(key text primary key, val text) on commit drop;

do $$
declare
  cap uuid[] := array['2d000000-0000-0000-0000-000000000001', '2d000000-0000-0000-0000-000000000002',
    '2d000000-0000-0000-0000-000000000003', '2d000000-0000-0000-0000-000000000004']::uuid[];
  mem uuid[] := array['2d000000-0000-0000-0000-000000000011', '2d000000-0000-0000-0000-000000000012',
    '2d000000-0000-0000-0000-000000000013', '2d000000-0000-0000-0000-000000000014']::uuid[];
  team uuid[] := array[]::uuid[];
  v_id uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adv-' || id || '@meq.test', '', now(), now(),
    jsonb_build_object('display_name', 'Advance')
  from unnest(cap || mem) id;
  update public.courts set is_open = true, opens_at = '00:00' where id in ('3x3-a', '3x3-b');
  for i in 1..4 loop
    insert into public.teams(name, format, captain_user_id) values ('Advance ' || chr(64 + i), 'THREE_X_THREE', cap[i]) returning id into v_id;
    team := team || v_id;
    insert into public.team_memberships(team_id, user_id, role) values (v_id, cap[i], 'CAPTAIN'), (v_id, mem[i], 'MEMBER');
  end loop;

  -- A rests after a second win, B lost and is still deciding, C waits.
  insert into public.queue_entries(court_id, team_id, status) values ('3x3-a', team[1], 'RESTING');
  insert into public.queue_entries(court_id, team_id, status, decision_deadline)
    values ('3x3-a', team[2], 'DECIDING_REQUEUE', now() + interval '3 minutes');
  insert into public.queue_entries(court_id, team_id, status, position) values ('3x3-a', team[3], 'WAITING', 1);
  perform private.expire_all_queue_timeouts();
  insert into obs select 'rest_while_deciding', status::text from public.queue_entries where team_id = team[1];

  -- B leaves, so the rest game cannot happen without A.
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  perform public.leave_court_queue((select id from public.queue_entries where team_id = team[2]));
  insert into obs select 'leave_audited', (count(*) = 1)::text from public.audit_logs
    where action = 'QUEUE_LEFT' and actor_user_id = cap[2];
  perform private.expire_all_queue_timeouts();
  insert into obs select 'rest_after_loser_left', status::text from public.queue_entries where team_id = team[1];

  -- Members verified 120 m away, inside the court radius.
  delete from public.team_check_ins;
  delete from public.queue_entries;
  insert into public.location_verifications(user_id, court_id, distance_metres, expires_at, provider)
  select id, '3x3-b', 120, now() + interval '30 minutes', 'DEVELOPMENT' from unnest(array[cap[1], mem[1]]) id;
  insert into public.queue_entries(court_id, team_id, status, called_at, check_in_deadline)
    values ('3x3-b', team[1], 'CALLED', now(), now() + interval '3 minutes') returning id into v_id;
  insert into public.team_check_ins(queue_entry_id, team_id, court_id, deadline) values (v_id, team[1], '3x3-b', now() + interval '3 minutes');
  perform set_config('request.jwt.claim.sub', cap[1]::text, true);
  perform public.confirm_team_ready((select id from public.team_check_ins where team_id = team[1]));
  insert into obs select 'ready_inside_radius', status::text from public.team_check_ins where team_id = team[1];

  -- An expired verification asks for a new one instead of "out of range".
  insert into public.location_verifications(user_id, court_id, distance_metres, verified_at, expires_at, provider)
  values (cap[2], '3x3-b', 10, now(), now() + interval '30 minutes', 'DEVELOPMENT'),
         (mem[2], '3x3-b', 10, now() - interval '31 minutes', now() - interval '1 minute', 'DEVELOPMENT');
  insert into public.queue_entries(court_id, team_id, status, called_at, check_in_deadline)
    values ('3x3-b', team[2], 'CALLED', now(), now() + interval '3 minutes') returning id into v_id;
  insert into public.team_check_ins(queue_entry_id, team_id, court_id, deadline) values (v_id, team[2], '3x3-b', now() + interval '3 minutes');
  perform set_config('request.jwt.claim.sub', cap[2]::text, true);
  begin
    perform public.confirm_team_ready((select id from public.team_check_ins where team_id = team[2]));
    insert into obs values ('expired_verification', 'ok');
  exception when check_violation then
    insert into obs values ('expired_verification', sqlerrm);
  end;
end;
$$;

-- One court fails while it advances; the other court still advances.
create function pg_temp.fail_on_court_a() returns trigger language plpgsql as $$
begin
  if new.court_id = '3x3-a' and new.status = 'CALLED' then raise exception 'SIMULATED_FAILURE'; end if;
  return new;
end;
$$;
create trigger fail_on_court_a before update on public.queue_entries
for each row execute function pg_temp.fail_on_court_a();

do $$
declare
  t uuid[];
begin
  delete from public.team_check_ins;
  delete from public.queue_entries;
  select array_agg(id order by name) into t from public.teams where name like 'Advance %';
  insert into public.queue_entries(court_id, team_id, status, position, joined_at) values
    ('3x3-a', t[1], 'WAITING', 1, now() - interval '2 minutes'), ('3x3-a', t[2], 'WAITING', 2, now() - interval '1 minute');
  insert into public.queue_entries(court_id, team_id, status, position, joined_at) values
    ('3x3-b', t[3], 'WAITING', 1, now() - interval '2 minutes'), ('3x3-b', t[4], 'WAITING', 2, now() - interval '1 minute');
  perform private.expire_all_queue_timeouts();
  insert into obs select 'failure_logged', (count(*) = 1)::text from public.audit_logs
    where action = 'QUEUE_ADVANCE_FAILED' and entity_id = '3x3-a' and payload->>'error' like '%SIMULATED_FAILURE%';
  insert into obs select 'other_court_ran', count(*)::text from public.queue_entries where court_id = '3x3-b' and status = 'CALLED';
  insert into obs select 'failed_court_untouched', count(*)::text from public.queue_entries where court_id = '3x3-a' and status = 'WAITING';
end;
$$;
drop trigger fail_on_court_a on public.queue_entries;

select is((select val from obs where key = 'rest_while_deciding'), 'RESTING', 'winner keeps resting while the loser decides');
select is((select val from obs where key = 'leave_audited'), 'true', 'leaving a queue is audited');
select is((select val from obs where key = 'rest_after_loser_left'), 'CALLED', 'resting winner is called with the waiting team once the loser leaves');
select is((select val from obs where key = 'ready_inside_radius'), 'READY', 'captain can confirm ready with members verified inside the court radius');
select is((select val from obs where key = 'expired_verification'), 'LOCATION_VERIFICATION_REQUIRED', 'expired verification asks members to verify again');
select is((select val from obs where key = 'failure_logged'), 'true', 'a failing court is logged instead of stopping the queue job');
select is((select val from obs where key = 'other_court_ran'), '2', 'other courts still call their teams when one court fails');
select is((select val from obs where key = 'failed_court_untouched'), '2', 'the failing court rolls back to its previous state');

select * from finish();
rollback;
