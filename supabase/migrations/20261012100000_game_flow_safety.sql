-- Keep games from blocking a court and let teams delegate game duties.
--
-- 1. Score deadline: after a captain requests the end of a game, both teams
--    have queue_settings.score_submission_seconds (default 5 minutes) to
--    submit scores. If the deadline passes without a valid result, the game
--    is cancelled without a result and the court is released.
-- 2. Admins can cancel a stuck game or decide its final score.
-- 3. A captain can name one current team member as game delegate, who may
--    confirm ready, request or reject the end of a game, submit scores, agree
--    on the target score, and make post-game decisions. Team management
--    (invite, remove, transfer, dissolve) stays captain-only.

alter table public.teams
  add column game_delegate_user_id uuid references public.profiles(id);

alter table public.games
  add column score_deadline timestamptz;

alter table public.queue_settings
  add column score_submission_seconds integer not null default 300
    check (score_submission_seconds between 60 and 1800);

alter table public.line_notifications drop constraint line_notifications_kind_check;
alter table public.line_notifications add constraint line_notifications_kind_check check (kind in (
  'QUEUE_CALLED', 'QUEUE_NEXT', 'TEAM_INVITATION', 'GAME_RESULT',
  'SCORE_REQUEST', 'GAME_CANCELLED',
  'MAINTENANCE_NEW', 'MAINTENANCE_STATUS', 'MAINTENANCE_WAITING_REMINDER'
));

create or replace function private.score_submission_seconds()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select score_submission_seconds from public.queue_settings where singleton = true), 300);
$$;

-- Captain, or the delegate while they are still an active member of the team.
create or replace function private.is_team_game_leader(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams team
    where team.id = p_team_id
      and team.dissolved_at is null
      and (
        team.captain_user_id = (select auth.uid())
        or (
          team.game_delegate_user_id = (select auth.uid())
          and exists (
            select 1 from public.team_memberships membership
            where membership.team_id = team.id
              and membership.user_id = team.game_delegate_user_id
              and membership.left_at is null
          )
        )
      )
  );
$$;

create or replace function public.set_team_game_delegate(p_team_id uuid, p_user_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_team_captain(p_team_id) then
    raise exception using errcode = '42501', message = 'CAPTAIN_ONLY';
  end if;
  if p_user_id is not null then
    if p_user_id = auth.uid() then
      raise exception using errcode = '23514', message = 'CAPTAIN_CANNOT_BE_DELEGATE';
    end if;
    if not exists (
      select 1 from public.team_memberships
      where team_id = p_team_id and user_id = p_user_id and left_at is null
    ) then
      raise exception using errcode = '23514', message = 'NOT_TEAM_MEMBER';
    end if;
  end if;

  update public.teams
  set game_delegate_user_id = p_user_id, updated_at = now()
  where id = p_team_id
  returning * into v_team;
  return v_team;
end;
$$;

-- Shared tail of a finished game once the winner and final scores are known.
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
  update public.queue_entries set status = case when v_winner_streak >= 2 then 'RESTING'::public.queue_status
      else 'DECIDING_CONTINUE'::public.queue_status end, position = null
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
  if v_a = v_b then
    update public.games set status = 'INVALID_SCORE', invalid_reason = 'TIED_SCORE' where id = p_game_id returning * into v_game;
    return v_game;
  end if;
  if v_a < v_game.target_score and v_b < v_game.target_score then
    update public.games set status = 'INVALID_SCORE', invalid_reason = 'NO_TEAM_REACHED_TARGET' where id = p_game_id returning * into v_game;
    return v_game;
  end if;
  if v_a >= v_game.target_score and v_b >= v_game.target_score then
    update public.games set status = 'INVALID_SCORE', invalid_reason = 'BOTH_TEAMS_REACHED_TARGET' where id = p_game_id returning * into v_game;
    return v_game;
  end if;
  return private.complete_game_with_scores(p_game_id, v_a, v_b);
end;
$$;

-- End a game with no result: both teams leave the queue, nothing is
-- recorded in player history, and the court is free for the next team.
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

create or replace function private.expire_score_submissions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game record;
begin
  for v_game in
    select id from public.games
    where status in ('END_REQUESTED', 'AWAITING_SCORE', 'INVALID_SCORE')
      and score_deadline is not null and score_deadline < now()
    for update skip locked
  loop
    perform private.cancel_game_without_result(v_game.id, 'SCORE_TIMEOUT');
  end loop;
end;
$$;

create or replace function public.admin_cancel_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  return private.cancel_game_without_result(p_game_id, 'ADMIN_CANCELLED');
end;
$$;

-- Admin decides the final team scores. Players without submitted points
-- are recorded with 0 in their history.
create or replace function public.admin_resolve_game(p_game_id uuid, p_team_a_score integer, p_team_b_score integer)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  if p_team_a_score is null or p_team_b_score is null or p_team_a_score < 0 or p_team_b_score < 0 then
    raise exception using errcode = '22023', message = 'INVALID_SCORE_VALUE';
  end if;
  if p_team_a_score = p_team_b_score then
    raise exception using errcode = '23514', message = 'TIED_SCORE';
  end if;
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  if v_game.status in ('COMPLETED', 'CANCELLED') then
    raise exception using errcode = '23514', message = 'INVALID_GAME_STATUS';
  end if;
  return private.complete_game_with_scores(p_game_id, p_team_a_score, p_team_b_score);
end;
$$;

-- LINE: ask both teams' leaders for scores once an end is requested.
create or replace function private.notify_score_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court_name text;
  v_requesting_team text;
  v_leader record;
begin
  select name into v_court_name from public.courts where id = new.court_id;
  select name into v_requesting_team from public.teams where id = new.end_requested_by_team_id;

  for v_leader in
    select distinct leader.user_id
    from public.teams team
    cross join lateral (values (team.captain_user_id), (team.game_delegate_user_id)) as leader(user_id)
    where team.id in (new.team_a_id, new.team_b_id) and leader.user_id is not null
  loop
    perform private.enqueue_line_notification(
      v_leader.user_id,
      'SCORE_REQUEST',
      format(E'ทีม %s ขอจบเกมที่สนาม %s\nส่งคะแนนรายคนของทีมคุณภายใน %s น.\nถ้าส่งไม่ครบทันเวลา เกมนี้จะไม่มีผลและสนามจะว่างให้ทีมถัดไป',
        coalesce(v_requesting_team, 'คู่แข่ง'),
        coalesce(v_court_name, new.court_id),
        to_char(coalesce(new.score_deadline, now() + interval '5 minutes') at time zone 'Asia/Bangkok', 'HH24:MI')),
      '/games/' || new.id || '/scores',
      'score-request:' || new.id || ':' || v_leader.user_id || ':' || extract(epoch from new.end_requested_at)::bigint,
      coalesce(new.score_deadline, now() + interval '5 minutes')
    );
  end loop;
  return new;
end;
$$;

create trigger games_notify_score_request
after update of status on public.games
for each row
when (new.status = 'END_REQUESTED' and old.status is distinct from 'END_REQUESTED')
execute function private.notify_score_request();

-- LINE: tell every player when a game ends without a result.
create or replace function private.notify_game_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court_name text;
  v_reason text;
  v_player record;
begin
  select name into v_court_name from public.courts where id = new.court_id;
  v_reason := case new.invalid_reason
    when 'SCORE_TIMEOUT' then 'ส่งคะแนนไม่ครบภายในเวลาที่กำหนด'
    when 'ADMIN_CANCELLED' then 'แอดมินยกเลิกเกม'
    else 'เกมถูกยกเลิก'
  end;

  for v_player in select user_id from public.game_roster_snapshots where game_id = new.id loop
    perform private.enqueue_line_notification(
      v_player.user_id,
      'GAME_CANCELLED',
      format(E'เกมที่สนาม %s ไม่มีผล\nเหตุผล: %s\nทั้งสองทีมออกจากคิวแล้ว ลงคิวใหม่ได้ตามปกติ',
        coalesce(v_court_name, new.court_id), v_reason),
      '/courts/' || new.court_id,
      'game-cancelled:' || new.id || ':' || v_player.user_id,
      now() + interval '2 hours'
    );
  end loop;
  return new;
end;
$$;

create trigger games_notify_cancelled
after update of status on public.games
for each row
when (new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED')
execute function private.notify_game_cancelled();

revoke execute on function private.score_submission_seconds() from public, anon, authenticated;
revoke execute on function private.is_team_game_leader(uuid) from public, anon, authenticated;
revoke execute on function private.complete_game_with_scores(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function private.cancel_game_without_result(uuid, text) from public, anon, authenticated;
revoke execute on function private.expire_score_submissions() from public, anon, authenticated;
revoke execute on function private.notify_score_request() from public, anon, authenticated;
revoke execute on function private.notify_game_cancelled() from public, anon, authenticated;
revoke execute on function public.set_team_game_delegate(uuid, uuid) from public, anon;
grant execute on function public.set_team_game_delegate(uuid, uuid) to authenticated;
revoke execute on function public.admin_cancel_game(uuid) from public, anon;
grant execute on function public.admin_cancel_game(uuid) to authenticated;
revoke execute on function public.admin_resolve_game(uuid, integer, integer) from public, anon;
grant execute on function public.admin_resolve_game(uuid, integer, integer) to authenticated;

select cron.schedule('meq-expire-score-submissions', '30 seconds', 'select private.expire_score_submissions();');

-- Game-flow RPCs below are the current definitions with the captain check
-- widened to private.is_team_game_leader, plus the score deadline.

CREATE OR REPLACE FUNCTION public.confirm_team_ready(p_check_in_id uuid)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.team_check_ins;
  v_first public.team_check_ins;
  v_second public.team_check_ins;
  v_game public.games;
  v_target integer;
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
$function$;

CREATE OR REPLACE FUNCTION public.propose_game_target_score(p_check_in_id uuid, p_target_score integer)
 RETURNS game_target_score_proposals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_own public.team_check_ins;v_other public.team_check_ins;v_allowed integer[];v_result public.game_target_score_proposals;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_own from public.team_check_ins where id=p_check_in_id for update;
  if v_own.id is null then raise exception using errcode='P0002',message='SESSION_NOT_FOUND'; end if;
  if not private.is_team_game_leader(v_own.team_id) then raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  perform pg_advisory_xact_lock(hashtext('meq-target-'||v_own.court_id));
  perform private.expire_court_check_ins(v_own.court_id);
  select * into v_own from public.team_check_ins where id=p_check_in_id;
  if v_own.status not in ('ACTIVE','READY') then raise exception using errcode='23514',message='SESSION_NOT_ACTIVE'; end if;
  select * into v_other from public.team_check_ins where court_id=v_own.court_id and id<>v_own.id
    and status in ('ACTIVE','READY') order by created_at,id limit 1 for update;
  if v_other.id is null then raise exception using errcode='P0002',message='OPPONENT_NOT_CALLED'; end if;
  select g.allowed_target_scores into v_allowed from public.courts c join public.court_groups g on g.id=c.court_group_id where c.id=v_own.court_id;
  if not p_target_score=any(v_allowed) then raise exception using errcode='23514',message='INVALID_TARGET_SCORE'; end if;
  update public.game_target_score_proposals set status='CANCELLED'
    where court_id=v_own.court_id and status in ('PENDING','CONFIRMED');
  insert into public.game_target_score_proposals(court_id,proposer_check_in_id,opponent_check_in_id,proposed_by_team_id,target_score)
    values(v_own.court_id,v_own.id,v_other.id,v_own.team_id,p_target_score) returning * into v_result;
  return v_result;
end;$function$;

CREATE OR REPLACE FUNCTION public.confirm_game_target_score(p_proposal_id uuid)
 RETURNS game_target_score_proposals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result public.game_target_score_proposals;v_opponent public.team_check_ins;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_result from public.game_target_score_proposals where id=p_proposal_id for update;
  if v_result.id is null then raise exception using errcode='P0002',message='PROPOSAL_NOT_FOUND'; end if;
  if v_result.status<>'PENDING' then raise exception using errcode='23514',message='PROPOSAL_NOT_PENDING'; end if;
  select * into v_opponent from public.team_check_ins where id=v_result.opponent_check_in_id for update;
  if v_opponent.status not in ('ACTIVE','READY') then raise exception using errcode='23514',message='SESSION_NOT_ACTIVE'; end if;
  if not private.is_team_game_leader(v_opponent.team_id) then raise exception using errcode='42501',message='OPPONENT_CAPTAIN_ONLY'; end if;
  update public.game_target_score_proposals set status='CONFIRMED',confirmed_by_team_id=v_opponent.team_id,confirmed_at=now()
    where id=p_proposal_id returning * into v_result;
  return v_result;
end;$function$;

CREATE OR REPLACE FUNCTION public.request_game_end(p_game_id uuid)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_game public.games; v_team_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'PLAYING' then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if private.is_team_game_leader(v_game.team_a_id) then v_team_id:=v_game.team_a_id;
  elsif private.is_team_game_leader(v_game.team_b_id) then v_team_id:=v_game.team_b_id;
  else raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  update public.games set status='END_REQUESTED',end_requested_by_team_id=v_team_id,
    end_requested_by_user_id=auth.uid(),end_requested_at=now(),score_deadline=now()+make_interval(secs=>private.score_submission_seconds()) where id=p_game_id returning * into v_game;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'GAME_END_REQUESTED','game',p_game_id::text,jsonb_build_object('teamId',v_team_id));
  return v_game;
end;$function$;

CREATE OR REPLACE FUNCTION public.cancel_game_end_request(p_game_id uuid)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_game public.games;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'END_REQUESTED' then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if v_game.end_requested_by_user_id<>auth.uid() then raise exception using errcode='42501',message='NOT_REQUEST_OWNER'; end if;
  delete from public.player_scores where game_id=p_game_id;
  delete from public.score_submissions where game_id=p_game_id;
  update public.games set status='PLAYING',end_requested_by_team_id=null,end_requested_by_user_id=null,end_requested_at=null,score_deadline=null
    where id=p_game_id returning * into v_game;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
    values(auth.uid(),'GAME_END_REQUEST_CANCELLED','game',p_game_id::text);
  return v_game;
end;$function$;

CREATE OR REPLACE FUNCTION public.reject_game_end_request(p_game_id uuid)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_game public.games; v_opponent_team_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'END_REQUESTED' then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  v_opponent_team_id:=case when v_game.end_requested_by_team_id=v_game.team_a_id then v_game.team_b_id else v_game.team_a_id end;
  if not private.is_team_game_leader(v_opponent_team_id) then raise exception using errcode='42501',message='CANNOT_CONFIRM_OWN_REQUEST'; end if;
  delete from public.player_scores where game_id=p_game_id;
  delete from public.score_submissions where game_id=p_game_id;
  update public.games set status='PLAYING',end_requested_by_team_id=null,end_requested_by_user_id=null,end_requested_at=null,score_deadline=null
    where id=p_game_id returning * into v_game;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
    values(auth.uid(),'GAME_END_REQUEST_REJECTED','game',p_game_id::text);
  return v_game;
end;$function$;

CREATE OR REPLACE FUNCTION public.submit_team_scores(p_game_id uuid, p_scores jsonb)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_game public.games;v_team_id uuid;v_expected integer;v_received integer;v_result public.games;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status='COMPLETED' then return v_game; end if;
  if v_game.status not in ('END_REQUESTED','AWAITING_SCORE','INVALID_SCORE') then
    raise exception using errcode='23514',message='INVALID_GAME_STATUS';
  end if;
  if v_game.score_deadline is not null and now()>v_game.score_deadline then
    raise exception using errcode='23514',message='SCORE_DEADLINE_PASSED';
  end if;
  if private.is_team_game_leader(v_game.team_a_id) then v_team_id:=v_game.team_a_id;
  elsif private.is_team_game_leader(v_game.team_b_id) then v_team_id:=v_game.team_b_id;
  else raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  if jsonb_typeof(p_scores)<>'object' then raise exception using errcode='22023',message='INVALID_SCORE_VALUE'; end if;
  select count(*) into v_expected from public.game_roster_snapshots where game_id=p_game_id and team_id=v_team_id;
  select count(*) into v_received from jsonb_each_text(p_scores) s join public.game_roster_snapshots gr
    on gr.user_id::text=s.key and gr.game_id=p_game_id and gr.team_id=v_team_id where s.value~'^[0-9]+$';
  if v_expected=0 or v_received<>v_expected or (select count(*) from jsonb_object_keys(p_scores))<>v_expected then
    raise exception using errcode='23514',message='INCOMPLETE_PLAYERS';
  end if;
  insert into public.player_scores(game_id,team_id,user_id,points)
    select p_game_id,v_team_id,s.key::uuid,s.value::integer from jsonb_each_text(p_scores) s
    on conflict(game_id,team_id,user_id) do update set points=excluded.points;
  insert into public.score_submissions(game_id,team_id,submitted_by_user_id,status,submitted_at)
    values(p_game_id,v_team_id,auth.uid(),'SUBMITTED',now())
    on conflict(game_id,team_id) do update set submitted_by_user_id=excluded.submitted_by_user_id,
      status='SUBMITTED',submitted_at=now(),updated_at=now();
  update public.games set status=case when (select count(*) from public.score_submissions
      where game_id=p_game_id and status='SUBMITTED')=2 then 'VALIDATING_RESULT'::public.game_status
      else 'AWAITING_SCORE'::public.game_status end where id=p_game_id;
  if (select count(*) from public.score_submissions where game_id=p_game_id and status='SUBMITTED')=2 then
    select * into v_result from private.finalize_game_result(p_game_id);
  else select * into v_result from public.games where id=p_game_id; end if;
  return v_result;
end;$function$;

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
  update public.queue_entries set status=case when p_continue then 'HOLDING_COURT'::public.queue_status else 'LEFT_QUEUE'::public.queue_status end,
    position=null,decision_deadline=null,closed_at=case when p_continue then null else now() end
    where id=v_entry.id returning * into v_entry;
  if not p_continue then delete from public.active_queue_players where queue_entry_id=v_entry.id; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'WINNER_CONTINUATION_DECIDED','game',p_game_id::text,
      jsonb_build_object('decision',case when p_continue then 'CONTINUE' else 'LEAVE' end,'queueEntryId',v_entry.id));
  return v_entry;
end;$function$;

CREATE OR REPLACE FUNCTION public.decide_loser_requeue(p_game_id uuid, p_requeue boolean)
 RETURNS queue_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_game public.games; v_entry public.queue_entries; v_timed_out boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'COMPLETED' or v_game.loser_team_id is null then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if not private.is_team_game_leader(v_game.loser_team_id) then raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
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
end;$function$;
