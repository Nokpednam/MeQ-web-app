-- Transactional post-game decisions. Browser countdowns are informational;
-- PostgreSQL owns every deadline and queue transition.

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
  if not p_continue then delete from public.active_queue_players where queue_entry_id=v_entry.id; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'WINNER_CONTINUATION_DECIDED','game',p_game_id::text,
      jsonb_build_object('decision',case when p_continue then 'CONTINUE' else 'LEAVE' end,'queueEntryId',v_entry.id));
  return v_entry;
end;$$;

create or replace function public.decide_loser_requeue(p_game_id uuid,p_requeue boolean)
returns public.queue_entries language plpgsql security definer set search_path = '' as $$
declare v_game public.games; v_entry public.queue_entries; v_timed_out boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'COMPLETED' or v_game.loser_team_id is null then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if not private.is_team_captain(v_game.loser_team_id) then raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  select * into v_entry from public.queue_entries where court_id=v_game.court_id and team_id=v_game.loser_team_id
    and status='DECIDING_REQUEUE' order by joined_at desc limit 1 for update;
  if v_entry.id is null then raise exception using errcode='P0002',message='DECISION_NOT_FOUND'; end if;
  v_timed_out:=v_entry.decision_deadline is null or v_entry.decision_deadline<=now();
  if p_requeue and not v_timed_out then
    update public.queue_entries set status='WAITING',position=null,joined_at=now(),decision_deadline=null,closed_at=null
      where id=v_entry.id returning * into v_entry;
    perform private.reorder_court_waiting_queue(v_game.court_id);
    select * into v_entry from public.queue_entries where id=v_entry.id;
  else
    update public.queue_entries set status='LEFT_QUEUE',position=null,decision_deadline=null,closed_at=now()
      where id=v_entry.id returning * into v_entry;
    delete from public.active_queue_players where queue_entry_id=v_entry.id;
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'LOSER_REQUEUE_DECIDED','game',p_game_id::text,
      jsonb_build_object('decision',case when v_timed_out then 'TIMEOUT' when p_requeue then 'REQUEUE' else 'LEAVE' end,'queueEntryId',v_entry.id));
  return v_entry;
end;$$;

create or replace function public.expire_post_game_decisions(p_court_id text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_expired_count integer; v_court_id text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  create temporary table if not exists pg_temp.expired_post_game_entries(id uuid,court_id text,team_id uuid) on commit drop;
  truncate pg_temp.expired_post_game_entries;
  with expired as (
    update public.queue_entries set status='LEFT_QUEUE',position=null,decision_deadline=null,closed_at=now()
    where status='DECIDING_REQUEUE' and decision_deadline<=now() and (p_court_id is null or court_id=p_court_id)
    returning id,court_id,team_id
  ) insert into pg_temp.expired_post_game_entries select * from expired;
  get diagnostics v_expired_count=row_count;
  delete from public.active_queue_players a using pg_temp.expired_post_game_entries e where a.queue_entry_id=e.id;
  insert into public.audit_logs(action,entity_type,entity_id,payload)
    select 'LOSER_REQUEUE_TIMED_OUT','queue_entry',e.id::text,jsonb_build_object('teamId',e.team_id,'courtId',e.court_id)
    from pg_temp.expired_post_game_entries e;
  for v_court_id in select distinct court_id from pg_temp.expired_post_game_entries loop
    perform private.reorder_court_waiting_queue(v_court_id);
  end loop;
  return v_expired_count;
end;$$;

revoke execute on function public.decide_winner_continuation(uuid,boolean) from public,anon;
revoke execute on function public.decide_loser_requeue(uuid,boolean) from public,anon;
revoke execute on function public.expire_post_game_decisions(text) from public,anon;
grant execute on function public.decide_winner_continuation(uuid,boolean) to authenticated;
grant execute on function public.decide_loser_requeue(uuid,boolean) to authenticated;
grant execute on function public.expire_post_game_decisions(text) to authenticated;
