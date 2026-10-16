-- While a winner decides whether to continue, the scheduler calls one
-- challenger to face it. If the winner then leaves or lets its decision time
-- out and nobody else waits, the challenger has no opponent; it used to stay
-- checking in until its deadline and was dropped as MISSED_QUEUE (field test,
-- 16 Oct 2026). leave_court_queue already handled this for a holding team;
-- the same rule now applies to both winner decisions.

create or replace function private.return_called_challenger(p_court_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.queue_entries where court_id = p_court_id
    and status in ('HOLDING_COURT', 'DECIDING_CONTINUE', 'WAITING', 'RESTING')) then
    return;
  end if;
  if (select count(*) from public.queue_entries where court_id = p_court_id
    and status in ('CALLED', 'CHECKING_IN', 'READY_TO_PLAY')) <> 1 then
    return;
  end if;
  update public.team_check_ins set status = 'CLOSED', closed_at = now()
  where court_id = p_court_id and status in ('ACTIVE', 'READY');
  update public.queue_entries
  set status = 'WAITING', joined_at = now() - interval '1 millisecond',
    called_at = null, check_in_deadline = null
  where court_id = p_court_id and status in ('CALLED', 'CHECKING_IN', 'READY_TO_PLAY');
  perform private.reorder_court_waiting_queue(p_court_id);
end;
$$;
revoke execute on function private.return_called_challenger(text) from public, anon, authenticated;

create or replace function private.expire_winner_decisions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_courts text[];
  v_court_id text;
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
  ), logged as (
    insert into public.audit_logs(action, entity_type, entity_id, payload)
    select 'WINNER_CONTINUATION_TIMED_OUT', 'queue_entry', e.id::text,
      jsonb_build_object('teamId', e.team_id, 'courtId', e.court_id)
    from expired e
  )
  select coalesce(array_agg(distinct court_id), '{}') into v_courts from expired;

  foreach v_court_id in array v_courts loop
    perform private.return_called_challenger(v_court_id);
  end loop;
end;
$$;
revoke execute on function private.expire_winner_decisions() from public, anon, authenticated;

create or replace function public.decide_winner_continuation(p_game_id uuid, p_continue boolean)
returns public.queue_entries language plpgsql security definer set search_path = '' as $$
declare v_game public.games; v_entry public.queue_entries;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'COMPLETED' or v_game.winner_team_id is null then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if not private.is_team_captain(v_game.winner_team_id) then raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  select * into v_entry from public.queue_entries where court_id=v_game.court_id and team_id=v_game.winner_team_id
    and status in ('DECIDING_CONTINUE','RESTING') order by joined_at desc limit 1 for update;
  if v_entry.id is null then raise exception using errcode='P0002',message='DECISION_NOT_FOUND'; end if;
  if v_entry.status='RESTING' then raise exception using errcode='23514',message='WINNER_MUST_REST'; end if;
  update public.queue_entries set status=case when p_continue then 'HOLDING_COURT'::public.queue_status else 'LEFT_QUEUE'::public.queue_status end,
    position=null,decision_deadline=null,closed_at=case when p_continue then null else now() end
    where id=v_entry.id returning * into v_entry;
  if not p_continue then
    delete from public.active_queue_players where queue_entry_id=v_entry.id;
    perform private.return_called_challenger(v_game.court_id);
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'WINNER_CONTINUATION_DECIDED','game',p_game_id::text,
      jsonb_build_object('decision',case when p_continue then 'CONTINUE' else 'LEAVE' end,'queueEntryId',v_entry.id));
  return v_entry;
end;$$;
