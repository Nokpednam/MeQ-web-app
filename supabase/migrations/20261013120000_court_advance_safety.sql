-- Fixes from the feature audit:
-- 1. A resting winner keeps resting while the loser of that game is still
--    deciding whether to requeue; only then is the rest game known.
-- 2. Team-ready confirmation accepts the same court radius as location
--    verification, so a member shown as verified can be confirmed. A missing
--    or expired verification reports LOCATION_VERIFICATION_REQUIRED.
-- 3. The queue job advances each court in its own subtransaction. A failing
--    court is rolled back and logged; the other courts still advance.
-- 4. Leaving a queue is written to the audit log.

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

  -- A resting team does not wait for a game that cannot start without it,
  -- but a loser still deciding may requeue and play the rest game.
  if v_called + v_waiting < v_needed
    and exists (select 1 from public.queue_entries where court_id = p_court_id and status = 'RESTING')
    and not exists (select 1 from public.queue_entries where court_id = p_court_id and status = 'DECIDING_REQUEUE') then
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
    begin
      perform private.advance_court(v_court_id);
    exception when others then
      insert into public.audit_logs(action, entity_type, entity_id, payload)
      values ('QUEUE_ADVANCE_FAILED', 'court', v_court_id,
        jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate));
    end;
  end loop;
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
      join public.courts c on c.id = l.court_id
      where l.user_id = m.user_id and l.court_id = v_session.court_id
        and l.distance_metres <= c.location_radius_metres and l.expires_at > now()
    )
  ) then raise exception using errcode='23514', message='LOCATION_VERIFICATION_REQUIRED'; end if;

  update public.team_check_ins set status='READY', captain_confirmed_by=auth.uid(),
    captain_confirmed_at=now() where id=v_session.id;
  update public.queue_entries set status='READY_TO_PLAY', position=null where id=v_session.queue_entry_id;
  return private.start_court_game(v_session.court_id);
end;
$function$;

create or replace function public.leave_court_queue(p_queue_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries where id = p_queue_entry_id for update;
  if v_entry.id is null then raise exception using errcode='P0002', message='QUEUE_ENTRY_NOT_FOUND'; end if;
  if not private.is_team_captain(v_entry.team_id) then
    raise exception using errcode='42501', message='CAPTAIN_ONLY';
  end if;
  if v_entry.status not in ('WAITING','DECIDING_REQUEUE','HOLDING_COURT') then
    raise exception using errcode='23514', message='CANNOT_LEAVE_ACTIVE_STATE';
  end if;
  update public.queue_entries set status='LEFT_QUEUE', closed_at=now(), position=null
    where id=v_entry.id;
  delete from public.active_queue_players where queue_entry_id=v_entry.id;
  if v_entry.status = 'HOLDING_COURT' then
    update public.teams set consecutive_wins = 0, updated_at = now() where id = v_entry.team_id;
    -- Without the holder, a called challenger needs an opponent. If nobody
    -- else waits, send it back to the head of the queue so it is not
    -- dropped when its check-in deadline passes.
    if not exists (select 1 from public.queue_entries
      where court_id = v_entry.court_id and status in ('WAITING', 'RESTING')) then
      update public.team_check_ins set status = 'CLOSED', closed_at = now()
      where court_id = v_entry.court_id and status in ('ACTIVE', 'READY');
      update public.queue_entries
      set status = 'WAITING', joined_at = now() - interval '1 millisecond',
        called_at = null, check_in_deadline = null
      where court_id = v_entry.court_id and status in ('CALLED', 'CHECKING_IN', 'READY_TO_PLAY');
    end if;
  end if;
  perform private.reorder_court_waiting_queue(v_entry.court_id);
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'QUEUE_LEFT', 'queue_entry', v_entry.id::text,
    jsonb_build_object('teamId', v_entry.team_id, 'courtId', v_entry.court_id, 'fromStatus', v_entry.status));
end;
$$;
