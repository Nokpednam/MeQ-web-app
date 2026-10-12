-- Run the winner rotation in the database and advance queues without an admin.
--
-- 1. A winner that continues (HOLDING_COURT) plays the next ready challenger.
--    It does not check in again; its roster stays locked while it holds.
-- 2. The winner has 3 minutes to decide. No decision means it leaves.
-- 3. After a second consecutive win the team rests for one game on the same
--    court, then returns to the head of the waiting queue.
-- 4. The 30-second cron calls the next waiting teams when the court needs
--    challengers. Admins can still call a team by hand.
-- 5. After INVALID_SCORE both teams must submit again; one team cannot
--    finalize the game alone with the other team's rejected scores.

create or replace function private.team_roster_locked(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.queue_entries
    where team_id = p_team_id
      and status in (
        'WAITING', 'CALLED', 'CHECKING_IN', 'READY_TO_PLAY', 'PLAYING',
        'AWAITING_SCORE', 'RESTING', 'RETURNING_CHAMPION',
        'DECIDING_REQUEUE', 'DECIDING_CONTINUE', 'HOLDING_COURT'
      )
  );
$$;

-- A resting team goes back to the head of the waiting queue.
create or replace function private.return_resting_teams(p_court_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_head timestamptz;
begin
  select least(min(joined_at), now()) - interval '1 millisecond' into v_head
  from public.queue_entries where court_id = p_court_id and status = 'WAITING';
  with returned as (
    update public.queue_entries
    set status = 'WAITING', joined_at = coalesce(v_head, now()), decision_deadline = null
    where court_id = p_court_id and status = 'RESTING'
    returning team_id
  )
  update public.teams set consecutive_wins = 0, updated_at = now()
  where id in (select team_id from returned);
  perform private.reorder_court_waiting_queue(p_court_id);
end;
$$;

-- Call the first waiting team to check in. Returns null when nobody waits.
create or replace function private.call_waiting_team(p_court_id text)
returns public.team_check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.queue_entries;
  v_session public.team_check_ins;
  v_deadline timestamptz;
begin
  select * into v_entry from public.queue_entries
  where court_id = p_court_id and status = 'WAITING'
  order by position, joined_at, id for update skip locked limit 1;
  if v_entry.id is null then return null; end if;

  v_deadline := now() + make_interval(secs => coalesce(
    (select check_in_duration_seconds from public.queue_settings where singleton = true), 180));
  update public.queue_entries set status = 'CALLED', position = null, called_at = now(),
    check_in_deadline = v_deadline
  where id = v_entry.id;
  perform private.reorder_court_waiting_queue(p_court_id);

  insert into public.team_check_ins(queue_entry_id, team_id, court_id, deadline)
  values (v_entry.id, v_entry.team_id, p_court_id, v_deadline)
  returning * into v_session;
  return v_session;
end;
$$;

-- Start the next game when its teams are ready: the holding winner against
-- the first ready challenger, or the first two ready challengers.
create or replace function private.start_court_game(p_court_id text)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holder public.queue_entries;
  v_first public.team_check_ins;
  v_second public.team_check_ins;
  v_team_a uuid;
  v_team_b uuid;
  v_entry_ids uuid[];
  v_check_in_ids uuid[];
  v_target integer;
  v_game public.games;
begin
  if exists (select 1 from public.games where court_id = p_court_id
    and status in ('PLAYING','END_REQUESTED','AWAITING_SCORE','VALIDATING_RESULT','INVALID_SCORE')) then
    return null;
  end if;
  -- The winner has not decided yet; wait for the decision or its timeout.
  if exists (select 1 from public.queue_entries where court_id = p_court_id and status = 'DECIDING_CONTINUE') then
    return null;
  end if;

  select * into v_holder from public.queue_entries
  where court_id = p_court_id and status = 'HOLDING_COURT' order by joined_at, id limit 1;
  select * into v_first from public.team_check_ins
  where court_id = p_court_id and status = 'READY' order by created_at, id limit 1;
  if v_first.id is null then return null; end if;

  if v_holder.id is not null then
    v_team_a := v_holder.team_id;
    v_team_b := v_first.team_id;
    v_entry_ids := array[v_holder.id, v_first.queue_entry_id];
    v_check_in_ids := array[v_first.id];
  else
    select * into v_second from public.team_check_ins
    where court_id = p_court_id and status = 'READY' and id <> v_first.id order by created_at, id limit 1;
    if v_second.id is null then return null; end if;
    v_team_a := v_first.team_id;
    v_team_b := v_second.team_id;
    v_entry_ids := array[v_first.queue_entry_id, v_second.queue_entry_id];
    v_check_in_ids := array[v_first.id, v_second.id];
  end if;

  select coalesce(s.target_score, g.default_target_score) into v_target
  from public.courts c join public.court_groups g on g.id = c.court_group_id
  left join lateral (select target_score from public.daily_score_settings d
    where d.court_group_id = c.court_group_id order by business_date desc limit 1) s on true
  where c.id = p_court_id;

  insert into public.games(court_id, team_a_id, team_b_id, target_score)
  values (p_court_id, v_team_a, v_team_b, v_target) returning * into v_game;
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain)
  select v_game.id, m.team_id, m.user_id, p.display_name, m.role = 'CAPTAIN'
  from public.team_memberships m join public.profiles p on p.id = m.user_id
  where m.left_at is null and m.team_id in (v_team_a, v_team_b);
  update public.queue_entries set status = 'PLAYING', position = null, decision_deadline = null
  where id = any(v_entry_ids);
  perform private.reorder_court_waiting_queue(p_court_id);
  update public.team_check_ins set status = 'CLOSED', closed_at = now() where id = any(v_check_in_ids);
  update public.courts set active_game_id = v_game.id, updated_at = now() where id = p_court_id;
  return v_game;
end;
$$;

-- Fill the court's challenger slots from the waiting queue. Teams are only
-- called once there are enough of them to play, so nobody waits alone on a
-- check-in deadline.
create or replace function private.advance_court(p_court_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts;
  v_needed integer;
  v_called integer;
  v_waiting integer;
begin
  perform pg_advisory_xact_lock(hashtext('meq-checkin-' || p_court_id));
  perform private.expire_court_check_ins(p_court_id);

  select * into v_court from public.courts where id = p_court_id;
  if v_court.id is null or not v_court.is_open
    or (now() at time zone 'Asia/Bangkok')::time < v_court.opens_at then
    return;
  end if;
  if exists (select 1 from public.court_event_courts cec
    join public.court_events ce on ce.id = cec.event_id
    where cec.court_id = p_court_id and ce.cancelled_at is null
      and now() >= ce.starts_at and now() < ce.ends_at) then
    return;
  end if;
  if exists (select 1 from public.games where court_id = p_court_id
    and status in ('PLAYING','END_REQUESTED','AWAITING_SCORE','VALIDATING_RESULT','INVALID_SCORE')) then
    return;
  end if;

  v_needed := case when exists (select 1 from public.queue_entries where court_id = p_court_id
    and status in ('HOLDING_COURT','DECIDING_CONTINUE')) then 1 else 2 end;
  select count(*) into v_called from public.team_check_ins
  where court_id = p_court_id and status in ('ACTIVE','READY');
  select count(*) into v_waiting from public.queue_entries
  where court_id = p_court_id and status = 'WAITING';

  -- A resting team does not wait for a game that cannot start without it.
  if v_called + v_waiting < v_needed
    and exists (select 1 from public.queue_entries where court_id = p_court_id and status = 'RESTING') then
    perform private.return_resting_teams(p_court_id);
    select count(*) into v_waiting from public.queue_entries
    where court_id = p_court_id and status = 'WAITING';
  end if;

  if v_called + v_waiting < v_needed then return; end if;
  for i in 1..greatest(v_needed - v_called, 0) loop
    perform private.call_waiting_team(p_court_id);
  end loop;
  perform private.start_court_game(p_court_id);
end;
$$;

create or replace function private.expire_winner_decisions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired as (
    update public.queue_entries
    set status = 'LEFT_QUEUE', position = null, decision_deadline = null, closed_at = now()
    where status = 'DECIDING_CONTINUE' and decision_deadline <= now()
    returning id, court_id, team_id
  ), released as (
    delete from public.active_queue_players a using expired e where a.queue_entry_id = e.id
  ), reset as (
    update public.teams set consecutive_wins = 0, updated_at = now()
    where id in (select team_id from expired)
  )
  insert into public.audit_logs(action, entity_type, entity_id, payload)
  select 'WINNER_CONTINUATION_TIMED_OUT', 'queue_entry', e.id::text,
    jsonb_build_object('teamId', e.team_id, 'courtId', e.court_id)
  from expired e;
end;
$$;

create or replace function private.expire_all_queue_timeouts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_court_id text;
begin
  perform private.expire_post_game_decisions_internal(null);
  perform private.expire_winner_decisions();
  for v_court_id in select id from public.courts order by id loop
    perform private.advance_court(v_court_id);
  end loop;
end;
$$;

create or replace function private.complete_game_with_scores(p_game_id uuid, p_team_a_score integer, p_team_b_score integer)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_winner uuid;
  v_loser uuid;
  v_winner_streak integer;
begin
  select * into v_game from public.games where id = p_game_id for update;
  v_winner := case when p_team_a_score > p_team_b_score then v_game.team_a_id else v_game.team_b_id end;
  v_loser := case when p_team_a_score > p_team_b_score then v_game.team_b_id else v_game.team_a_id end;
  select consecutive_wins + 1 into v_winner_streak from public.teams where id = v_winner for update;

  -- This was the rest game for any team resting on this court.
  perform private.return_resting_teams(v_game.court_id);

  update public.games set status = 'COMPLETED', winner_team_id = v_winner, loser_team_id = v_loser,
    final_team_a_score = p_team_a_score, final_team_b_score = p_team_b_score, invalid_reason = null,
    score_deadline = null, completed_at = now(), finalized_at = now()
  where id = p_game_id returning * into v_game;
  update public.courts set active_game_id = null, updated_at = now()
  where id = v_game.court_id and active_game_id = p_game_id;
  insert into public.player_game_history(game_id, user_id, team_id, format, court_id, points, won, completed_at)
    select p_game_id, roster.user_id, roster.team_id, team.format, v_game.court_id, coalesce(score.points, 0),
      roster.team_id = v_winner, v_game.completed_at
    from public.game_roster_snapshots roster
    left join public.player_scores score
      on score.game_id = roster.game_id and score.team_id = roster.team_id and score.user_id = roster.user_id
    join public.teams team on team.id = roster.team_id
    where roster.game_id = p_game_id
    on conflict (game_id, user_id) do nothing;
  update public.queue_entries set status = 'DECIDING_REQUEUE', decision_deadline = now() + interval '3 minutes', position = null
  where court_id = v_game.court_id and team_id = v_loser and status in ('PLAYING', 'AWAITING_SCORE');
  update public.queue_entries set
    status = case when v_winner_streak >= 2 then 'RESTING'::public.queue_status
      else 'DECIDING_CONTINUE'::public.queue_status end,
    decision_deadline = case when v_winner_streak >= 2 then null else now() + interval '3 minutes' end,
    position = null
  where court_id = v_game.court_id and team_id = v_winner and status in ('PLAYING', 'AWAITING_SCORE');
  update public.teams set consecutive_wins = case when id = v_winner then least(v_winner_streak, 2) else 0 end,
    updated_at = now()
  where id in (v_winner, v_loser);
  update public.team_check_ins set status = 'CLOSED', closed_at = now()
  where court_id = v_game.court_id and team_id in (v_winner, v_loser) and status in ('ACTIVE', 'READY');
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'GAME_FINALIZED', 'game', p_game_id::text,
    jsonb_build_object('winnerTeamId', v_winner, 'loserTeamId', v_loser, 'teamAScore', p_team_a_score, 'teamBScore', p_team_b_score));
  return v_game;
end;
$$;

create or replace function private.cancel_game_without_result(p_game_id uuid, p_reason text)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  if v_game.status in ('COMPLETED', 'CANCELLED') then
    raise exception using errcode = '23514', message = 'INVALID_GAME_STATUS';
  end if;

  -- A cancelled game still ends the rest of a team resting on this court.
  perform private.return_resting_teams(v_game.court_id);

  update public.games set status = 'CANCELLED', invalid_reason = p_reason, score_deadline = null, finalized_at = now()
  where id = p_game_id returning * into v_game;
  update public.courts set active_game_id = null, updated_at = now()
  where id = v_game.court_id and active_game_id = p_game_id;
  delete from public.active_queue_players
  where queue_entry_id in (
    select id from public.queue_entries
    where court_id = v_game.court_id and team_id in (v_game.team_a_id, v_game.team_b_id)
      and status in ('PLAYING', 'AWAITING_SCORE')
  );
  update public.queue_entries set status = 'CANCELLED', closed_at = now(), position = null
  where court_id = v_game.court_id and team_id in (v_game.team_a_id, v_game.team_b_id)
    and status in ('PLAYING', 'AWAITING_SCORE');
  update public.teams set consecutive_wins = 0, updated_at = now()
  where id in (v_game.team_a_id, v_game.team_b_id);
  update public.team_check_ins set status = 'CLOSED', closed_at = now()
  where court_id = v_game.court_id and team_id in (v_game.team_a_id, v_game.team_b_id) and status in ('ACTIVE', 'READY');
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'GAME_CANCELLED', 'game', p_game_id::text, jsonb_build_object('reason', p_reason));
  return v_game;
end;
$$;

create or replace function private.finalize_game_result(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_a integer;
  v_b integer;
  v_invalid_reason text;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  if v_game.status = 'COMPLETED' then return v_game; end if;
  if (select count(*) from public.score_submissions where game_id = p_game_id and status = 'SUBMITTED') <> 2 then
    raise exception using errcode = '23514', message = 'WAITING_FOR_OTHER_TEAM';
  end if;
  if exists (select 1 from public.game_roster_snapshots roster
    where roster.game_id = p_game_id and not exists (select 1 from public.player_scores score
      where score.game_id = roster.game_id and score.team_id = roster.team_id and score.user_id = roster.user_id)) then
    raise exception using errcode = '23514', message = 'INCOMPLETE_PLAYERS';
  end if;
  select coalesce(sum(points), 0) into v_a from public.player_scores where game_id = p_game_id and team_id = v_game.team_a_id;
  select coalesce(sum(points), 0) into v_b from public.player_scores where game_id = p_game_id and team_id = v_game.team_b_id;
  v_invalid_reason := case
    when v_a = v_b then 'TIED_SCORE'
    when v_a < v_game.target_score and v_b < v_game.target_score then 'NO_TEAM_REACHED_TARGET'
    when v_a >= v_game.target_score and v_b >= v_game.target_score then 'BOTH_TEAMS_REACHED_TARGET'
  end;
  if v_invalid_reason is not null then
    -- Both teams must submit again before the game can be finalized.
    update public.score_submissions set status = 'DRAFT', updated_at = now() where game_id = p_game_id;
    update public.games set status = 'INVALID_SCORE', invalid_reason = v_invalid_reason
    where id = p_game_id returning * into v_game;
    return v_game;
  end if;
  return private.complete_game_with_scores(p_game_id, v_a, v_b);
end;
$$;

CREATE OR REPLACE FUNCTION public.confirm_team_ready(p_check_in_id uuid)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.team_check_ins;
begin
  select * into v_session from public.team_check_ins where id = p_check_in_id for update;
  if v_session.id is null then raise exception using errcode='P0002', message='SESSION_NOT_FOUND'; end if;
  if not private.is_team_game_leader(v_session.team_id) then
    raise exception using errcode='42501', message='CAPTAIN_ONLY';
  end if;
  if v_session.status = 'READY' then return null; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode='23514', message='SESSION_NOT_ACTIVE'; end if;
  if v_session.deadline <= now() then
    perform private.expire_court_check_ins(v_session.court_id);
    raise exception using errcode='23514', message='CHECK_IN_EXPIRED';
  end if;
  if exists (
    select 1 from public.team_memberships m
    where m.team_id = v_session.team_id and m.left_at is null and not exists (
      select 1 from public.location_verifications l
      where l.user_id = m.user_id and l.court_id = v_session.court_id
        and l.distance_metres <= 50 and l.expires_at > now()
    )
  ) then raise exception using errcode='23514', message='OUT_OF_RANGE'; end if;

  update public.team_check_ins set status='READY', captain_confirmed_by=auth.uid(),
    captain_confirmed_at=now() where id=v_session.id;
  update public.queue_entries set status='READY_TO_PLAY', position=null where id=v_session.queue_entry_id;
  return private.start_court_game(v_session.court_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_winner_continuation(p_game_id uuid, p_continue boolean)
 RETURNS queue_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_game public.games; v_entry public.queue_entries;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'COMPLETED' or v_game.winner_team_id is null then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if not private.is_team_game_leader(v_game.winner_team_id) then raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  select * into v_entry from public.queue_entries where court_id=v_game.court_id and team_id=v_game.winner_team_id
    and status in ('DECIDING_CONTINUE','RESTING') order by joined_at desc limit 1 for update;
  if v_entry.id is null then raise exception using errcode='P0002',message='DECISION_NOT_FOUND'; end if;
  if v_entry.status='RESTING' then raise exception using errcode='23514',message='WINNER_MUST_REST'; end if;
  if v_entry.decision_deadline is not null and v_entry.decision_deadline<=now() then
    raise exception using errcode='23514',message='DECISION_EXPIRED';
  end if;
  update public.queue_entries set status=case when p_continue then 'HOLDING_COURT'::public.queue_status else 'LEFT_QUEUE'::public.queue_status end,
    position=null,decision_deadline=null,closed_at=case when p_continue then null else now() end
    where id=v_entry.id returning * into v_entry;
  if not p_continue then
    delete from public.active_queue_players where queue_entry_id=v_entry.id;
    update public.teams set consecutive_wins=0,updated_at=now() where id=v_entry.team_id;
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'WINNER_CONTINUATION_DECIDED','game',p_game_id::text,
      jsonb_build_object('decision',case when p_continue then 'CONTINUE' else 'LEAVE' end,'queueEntryId',v_entry.id));
  -- A challenger may already be ready and waiting for this decision.
  if p_continue then perform private.start_court_game(v_game.court_id); end if;
  select * into v_entry from public.queue_entries where id=v_entry.id;
  return v_entry;
end;$function$;

-- Manual fallback for admins: call one more team if the court still needs one.
create or replace function public.call_next_queue_team(p_court_id text)
returns public.team_check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_needed integer;
  v_session public.team_check_ins;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  if not exists (select 1 from public.courts where id = p_court_id) then
    raise exception using errcode = 'P0002', message = 'COURT_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext('meq-checkin-' || p_court_id));
  perform private.expire_court_check_ins(p_court_id);

  if exists (select 1 from public.games where court_id = p_court_id
    and status in ('PLAYING','END_REQUESTED','AWAITING_SCORE','VALIDATING_RESULT','INVALID_SCORE')) then
    raise exception using errcode = '23514', message = 'GAME_ALREADY_ACTIVE';
  end if;
  v_needed := case when exists (select 1 from public.queue_entries where court_id = p_court_id
    and status in ('HOLDING_COURT','DECIDING_CONTINUE')) then 1 else 2 end;
  if (select count(*) from public.team_check_ins where court_id = p_court_id and status in ('ACTIVE','READY')) >= v_needed then
    raise exception using errcode = '23514', message = 'TWO_TEAMS_ALREADY_CALLED';
  end if;

  v_session := private.call_waiting_team(p_court_id);
  if v_session.id is null then
    raise exception using errcode = 'P0002', message = 'NO_WAITING_TEAM';
  end if;
  return v_session;
end;
$$;

revoke execute on function private.return_resting_teams(text) from public, anon, authenticated;
revoke execute on function private.call_waiting_team(text) from public, anon, authenticated;
revoke execute on function private.start_court_game(text) from public, anon, authenticated;
revoke execute on function private.advance_court(text) from public, anon, authenticated;
revoke execute on function private.expire_winner_decisions() from public, anon, authenticated;
