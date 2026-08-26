-- Expire server-owned queue deadlines even when no browser is open.

create extension if not exists pg_cron;

create or replace function private.expire_post_game_decisions_internal(p_court_id text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_expired_count integer; v_court_id text;
begin
  create temporary table if not exists pg_temp.expired_post_game_entries(
    id uuid,
    court_id text,
    team_id uuid
  ) on commit drop;
  truncate pg_temp.expired_post_game_entries;

  with expired as (
    update public.queue_entries
    set status='LEFT_QUEUE',position=null,decision_deadline=null,closed_at=now()
    where status='DECIDING_REQUEUE'
      and decision_deadline<=now()
      and (p_court_id is null or court_id=p_court_id)
    returning id,court_id,team_id
  )
  insert into pg_temp.expired_post_game_entries select * from expired;
  get diagnostics v_expired_count=row_count;

  delete from public.active_queue_players a
  using pg_temp.expired_post_game_entries e
  where a.queue_entry_id=e.id;

  insert into public.audit_logs(action,entity_type,entity_id,payload)
  select 'LOSER_REQUEUE_TIMED_OUT','queue_entry',e.id::text,
    jsonb_build_object('teamId',e.team_id,'courtId',e.court_id)
  from pg_temp.expired_post_game_entries e;

  for v_court_id in select distinct court_id from pg_temp.expired_post_game_entries loop
    perform private.reorder_court_waiting_queue(v_court_id);
  end loop;
  return v_expired_count;
end;
$$;

create or replace function public.expire_post_game_decisions(p_court_id text default null)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='AUTH_REQUIRED';
  end if;
  return private.expire_post_game_decisions_internal(p_court_id);
end;
$$;

create or replace function private.expire_all_queue_timeouts()
returns void language plpgsql security definer set search_path = '' as $$
declare v_court_id text;
begin
  for v_court_id in select id from public.courts order by id loop
    perform pg_advisory_xact_lock(hashtext('meq-checkin-' || v_court_id));
    perform private.expire_court_check_ins(v_court_id);
  end loop;
  perform private.expire_post_game_decisions_internal(null);
end;
$$;

revoke execute on function private.expire_post_game_decisions_internal(text) from public,anon,authenticated;
revoke execute on function private.expire_all_queue_timeouts() from public,anon,authenticated;

select cron.schedule(
  'meq-expire-queue-timeouts',
  '30 seconds',
  'select private.expire_all_queue_timeouts();'
);
