-- Server-owned game-end requests and score submission lifecycle.

create or replace function public.request_game_end(p_game_id uuid)
returns public.games language plpgsql security definer set search_path='' as $$
declare v_game public.games; v_team_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'PLAYING' then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if private.is_team_captain(v_game.team_a_id) then v_team_id:=v_game.team_a_id;
  elsif private.is_team_captain(v_game.team_b_id) then v_team_id:=v_game.team_b_id;
  else raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  update public.games set status='END_REQUESTED',end_requested_by_team_id=v_team_id,
    end_requested_by_user_id=auth.uid(),end_requested_at=now() where id=p_game_id returning * into v_game;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'GAME_END_REQUESTED','game',p_game_id::text,jsonb_build_object('teamId',v_team_id));
  return v_game;
end;$$;

create or replace function public.cancel_game_end_request(p_game_id uuid)
returns public.games language plpgsql security definer set search_path='' as $$
declare v_game public.games;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'END_REQUESTED' then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  if v_game.end_requested_by_user_id<>auth.uid() then raise exception using errcode='42501',message='NOT_REQUEST_OWNER'; end if;
  delete from public.player_scores where game_id=p_game_id;
  delete from public.score_submissions where game_id=p_game_id;
  update public.games set status='PLAYING',end_requested_by_team_id=null,end_requested_by_user_id=null,end_requested_at=null
    where id=p_game_id returning * into v_game;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
    values(auth.uid(),'GAME_END_REQUEST_CANCELLED','game',p_game_id::text);
  return v_game;
end;$$;

create or replace function public.reject_game_end_request(p_game_id uuid)
returns public.games language plpgsql security definer set search_path='' as $$
declare v_game public.games; v_opponent_team_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status<>'END_REQUESTED' then raise exception using errcode='23514',message='INVALID_GAME_STATUS'; end if;
  v_opponent_team_id:=case when v_game.end_requested_by_team_id=v_game.team_a_id then v_game.team_b_id else v_game.team_a_id end;
  if not private.is_team_captain(v_opponent_team_id) then raise exception using errcode='42501',message='CANNOT_CONFIRM_OWN_REQUEST'; end if;
  delete from public.player_scores where game_id=p_game_id;
  delete from public.score_submissions where game_id=p_game_id;
  update public.games set status='PLAYING',end_requested_by_team_id=null,end_requested_by_user_id=null,end_requested_at=null
    where id=p_game_id returning * into v_game;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
    values(auth.uid(),'GAME_END_REQUEST_REJECTED','game',p_game_id::text);
  return v_game;
end;$$;

create or replace function public.submit_team_scores(p_game_id uuid,p_scores jsonb)
returns public.games language plpgsql security definer set search_path='' as $$
declare v_game public.games;v_team_id uuid;v_expected integer;v_received integer;v_result public.games;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002',message='GAME_NOT_FOUND'; end if;
  if v_game.status='COMPLETED' then return v_game; end if;
  if v_game.status not in ('END_REQUESTED','AWAITING_SCORE','INVALID_SCORE') then
    raise exception using errcode='23514',message='INVALID_GAME_STATUS';
  end if;
  if private.is_team_captain(v_game.team_a_id) then v_team_id:=v_game.team_a_id;
  elsif private.is_team_captain(v_game.team_b_id) then v_team_id:=v_game.team_b_id;
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
end;$$;

revoke execute on function public.request_game_end(uuid) from public,anon;
revoke execute on function public.cancel_game_end_request(uuid) from public,anon;
revoke execute on function public.reject_game_end_request(uuid) from public,anon;
grant execute on function public.request_game_end(uuid) to authenticated;
grant execute on function public.cancel_game_end_request(uuid) to authenticated;
grant execute on function public.reject_game_end_request(uuid) to authenticated;
