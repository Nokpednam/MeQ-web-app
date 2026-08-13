-- Reorder waiting teams without transiently violating the partial unique index.
-- Called/playing teams no longer occupy a visible waiting-list position.

create or replace function private.reorder_court_waiting_queue(p_court_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.queue_entries
  set position = null
  where court_id = p_court_id and status = 'WAITING';

  with ordered as (
    select id, row_number() over(order by joined_at, id)::bigint as new_position
    from public.queue_entries
    where court_id = p_court_id and status = 'WAITING'
  )
  update public.queue_entries q
  set position = ordered.new_position
  from ordered
  where q.id = ordered.id;
end;
$$;

create or replace function private.expire_court_check_ins(p_court_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.team_check_ins
  set status = 'EXPIRED', closed_at = now()
  where court_id = p_court_id and status = 'ACTIVE' and deadline <= now();

  update public.queue_entries q
  set status = 'MISSED_QUEUE', position = null, closed_at = now()
  where q.court_id = p_court_id and q.status in ('CALLED','CHECKING_IN')
    and exists (
      select 1 from public.team_check_ins c
      where c.queue_entry_id = q.id and c.status = 'EXPIRED'
    );

  delete from public.active_queue_players a
  using public.queue_entries q
  where a.queue_entry_id = q.id and q.court_id = p_court_id
    and q.status = 'MISSED_QUEUE';

  perform private.reorder_court_waiting_queue(p_court_id);
end;
$$;

create or replace function public.call_next_queue_team(p_court_id text)
returns public.team_check_ins language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.queue_entries;
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
  if (select count(*) from public.team_check_ins where court_id = p_court_id and status in ('ACTIVE','READY')) >= 2 then
    raise exception using errcode = '23514', message = 'TWO_TEAMS_ALREADY_CALLED';
  end if;

  select * into v_entry from public.queue_entries
  where court_id = p_court_id and status = 'WAITING'
  order by position, joined_at, id for update skip locked limit 1;
  if v_entry.id is null then
    raise exception using errcode = 'P0002', message = 'NO_WAITING_TEAM';
  end if;

  update public.queue_entries set status = 'CALLED', position = null, called_at = now(),
    check_in_deadline = now() + interval '3 minutes'
  where id = v_entry.id;
  perform private.reorder_court_waiting_queue(p_court_id);

  insert into public.team_check_ins(queue_entry_id, team_id, court_id, deadline)
  values(v_entry.id, v_entry.team_id, p_court_id, now() + interval '3 minutes')
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.leave_court_queue(p_queue_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries where id = p_queue_entry_id for update;
  if v_entry.id is null then raise exception using errcode='P0002', message='QUEUE_ENTRY_NOT_FOUND'; end if;
  if not private.is_team_captain(v_entry.team_id) then
    raise exception using errcode='42501', message='CAPTAIN_ONLY';
  end if;
  if v_entry.status not in ('WAITING','DECIDING_REQUEUE') then
    raise exception using errcode='23514', message='CANNOT_LEAVE_ACTIVE_STATE';
  end if;
  update public.queue_entries set status='LEFT_QUEUE', closed_at=now(), position=null
    where id=v_entry.id;
  delete from public.active_queue_players where queue_entry_id=v_entry.id;
  perform private.reorder_court_waiting_queue(v_entry.court_id);
end;
$$;

create or replace function public.confirm_team_ready(p_check_in_id uuid)
returns public.games language plpgsql security definer set search_path = '' as $$
declare
  v_session public.team_check_ins;
  v_first public.team_check_ins;
  v_second public.team_check_ins;
  v_game public.games;
  v_target integer;
begin
  select * into v_session from public.team_check_ins where id = p_check_in_id for update;
  if v_session.id is null then raise exception using errcode='P0002', message='SESSION_NOT_FOUND'; end if;
  if not private.is_team_captain(v_session.team_id) then
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

  select * into v_first from public.team_check_ins
  where court_id=v_session.court_id and status='READY' order by created_at,id limit 1;
  select * into v_second from public.team_check_ins
  where court_id=v_session.court_id and status='READY' and id<>v_first.id order by created_at,id limit 1;
  if v_second.id is null then return null; end if;

  select coalesce(s.target_score,g.default_target_score) into v_target
  from public.courts c join public.court_groups g on g.id=c.court_group_id
  left join lateral (select target_score from public.daily_score_settings d
    where d.court_group_id=c.court_group_id order by business_date desc limit 1) s on true
  where c.id=v_session.court_id;

  insert into public.games(court_id,team_a_id,team_b_id,target_score)
  values(v_session.court_id,v_first.team_id,v_second.team_id,v_target) returning * into v_game;
  insert into public.game_roster_snapshots(game_id,team_id,user_id,display_name,is_captain)
  select v_game.id,m.team_id,m.user_id,p.display_name,m.role='CAPTAIN'
  from public.team_memberships m join public.profiles p on p.id=m.user_id
  where m.left_at is null and m.team_id in(v_first.team_id,v_second.team_id);
  update public.queue_entries set status='PLAYING',position=null where id in(v_first.queue_entry_id,v_second.queue_entry_id);
  perform private.reorder_court_waiting_queue(v_session.court_id);
  update public.team_check_ins set status='CLOSED',closed_at=now() where id in(v_first.id,v_second.id);
  update public.courts set active_game_id=v_game.id,updated_at=now() where id=v_game.court_id;
  return v_game;
end;
$$;

revoke execute on function private.reorder_court_waiting_queue(text) from public, anon, authenticated;
revoke execute on function private.expire_court_check_ins(text) from public, anon, authenticated;
revoke execute on function public.call_next_queue_team(text) from public, anon;
revoke execute on function public.leave_court_queue(uuid) from public, anon;
revoke execute on function public.confirm_team_ready(uuid) from public, anon;
grant execute on function public.call_next_queue_team(text) to authenticated;
grant execute on function public.leave_court_queue(uuid) to authenticated;
grant execute on function public.confirm_team_ready(uuid) to authenticated;
