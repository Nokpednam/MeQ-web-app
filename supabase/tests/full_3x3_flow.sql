begin;
select plan(1);

do $$
declare
  a1 uuid := '41000000-0000-0000-0000-000000000001';
  a2 uuid := '41000000-0000-0000-0000-000000000002';
  a3 uuid := '41000000-0000-0000-0000-000000000003';
  b1 uuid := '41000000-0000-0000-0000-000000000004';
  b2 uuid := '41000000-0000-0000-0000-000000000005';
  b3 uuid := '41000000-0000-0000-0000-000000000006';
  team_a public.teams;
  team_b public.teams;
  check_a uuid;
  check_b uuid;
  target_proposal_id uuid;
  v_game_id uuid;
  game_status public.game_status;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at,raw_user_meta_data)
  select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',id::text||'@full-flow.meq.test','',now(),now(),jsonb_build_object('display_name','Flow QA')
  from unnest(array[a1,a2,a3,b1,b2,b3]) id;

  update public.profiles set display_name=case id when a1 then 'Alpha Captain' when a2 then 'Alpha Two' when a3 then 'Alpha Three' when b1 then 'Beta Captain' when b2 then 'Beta Two' else 'Beta Three' end
  where id in(a1,a2,a3,b1,b2,b3);

  perform set_config('request.jwt.claim.sub',a1::text,true);
  team_a:=public.create_team('Flow Alpha','THREE_X_THREE');
  perform public.add_team_member(team_a.id,a2);
  perform public.add_team_member(team_a.id,a3);
  perform set_config('request.jwt.claim.sub',b1::text,true);
  team_b:=public.create_team('Flow Beta','THREE_X_THREE');
  perform public.add_team_member(team_b.id,b2);
  perform public.add_team_member(team_b.id,b3);

  insert into public.location_verifications(user_id,court_id,distance_metres,expires_at,provider)
  select id,'3x3-a',10,now()+interval '30 minutes','DEVELOPMENT' from unnest(array[a1,a2,a3,b1,b2,b3]) id;
  perform set_config('request.jwt.claim.sub',a1::text,true);perform public.join_court_queue('3x3-a');
  perform set_config('request.jwt.claim.sub',b1::text,true);perform public.join_court_queue('3x3-a');

  update public.profiles set role='ADMIN' where id=a1;
  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.call_next_queue_team('3x3-a');
  perform public.call_next_queue_team('3x3-a');
  select id into check_a from public.team_check_ins where team_id=team_a.id and status='ACTIVE';
  select id into check_b from public.team_check_ins where team_id=team_b.id and status='ACTIVE';
  select id into target_proposal_id from public.propose_game_target_score(check_a,9);
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.confirm_game_target_score(target_proposal_id);
  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.confirm_team_ready(check_a);
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.confirm_team_ready(check_b);

  select id,status into v_game_id,game_status
  from public.games
  where court_id='3x3-a' and status='PLAYING'
    and team_a_id in (team_a.id,team_b.id) and team_b_id in (team_a.id,team_b.id)
  order by created_at desc limit 1;
  if v_game_id is null or game_status<>'PLAYING' then raise exception 'game was not created'; end if;
  if (select target_score from public.games where id=v_game_id)<>9 then raise exception 'confirmed target score was not applied'; end if;

  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.request_game_end(v_game_id);
  perform public.cancel_game_end_request(v_game_id);
  perform public.request_game_end(v_game_id);
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.reject_game_end_request(v_game_id);
  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.request_game_end(v_game_id);
  perform public.submit_team_scores(v_game_id,jsonb_build_object(a1::text,7,a2::text,2,a3::text,0));
  if (select status from public.games where id=v_game_id)<>'AWAITING_SCORE' then raise exception 'first submission status invalid'; end if;
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.submit_team_scores(v_game_id,jsonb_build_object(b1::text,3,b2::text,2,b3::text,0));

  if not exists(
    select 1 from public.games g
    where g.id=v_game_id and g.status='COMPLETED' and g.winner_team_id=team_a.id
      and ((g.team_a_id=team_a.id and g.final_team_a_score=9 and g.final_team_b_score=5)
        or (g.team_b_id=team_a.id and g.final_team_b_score=9 and g.final_team_a_score=5))
  ) then raise exception '9-5 result not finalized'; end if;
  if (select count(*) from public.player_game_history h where h.game_id=v_game_id)<>6 then raise exception 'player history was not created for all players'; end if;
  if not exists(select 1 from public.queue_entries where team_id=team_a.id and status='DECIDING_CONTINUE') then raise exception 'winner continuation decision was not created'; end if;
  if not exists(select 1 from public.queue_entries where team_id=team_b.id and status='DECIDING_REQUEUE') then raise exception 'loser decision was not created'; end if;
  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.decide_winner_continuation(v_game_id,true);
  if not exists(select 1 from public.queue_entries where team_id=team_a.id and status='HOLDING_COURT') then raise exception 'winner did not hold the court'; end if;
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.decide_loser_requeue(v_game_id,true);
  if not exists(select 1 from public.queue_entries where team_id=team_b.id and status='WAITING' and position=1) then raise exception 'loser did not requeue at the tail'; end if;
  update public.queue_entries set status='DECIDING_REQUEUE',position=null,decision_deadline=now()-interval '1 second'
    where team_id=team_b.id and court_id='3x3-a' and status='WAITING';
  if public.expire_post_game_decisions('3x3-a')<>1 then raise exception 'expired loser decision was not processed'; end if;
  if not exists(select 1 from public.queue_entries where team_id=team_b.id and status='LEFT_QUEUE') then raise exception 'timed-out loser did not leave'; end if;
  if exists(select 1 from public.active_queue_players where team_id=team_b.id) then raise exception 'timed-out loser reservations were not released'; end if;
  perform public.submit_team_scores(v_game_id,jsonb_build_object(b1::text,3,b2::text,2,b3::text,0));
  if (select count(*) from public.player_game_history h where h.game_id=v_game_id)<>6 then raise exception 'duplicate finalization changed history'; end if;
  raise notice 'FULL_3X3_FLOW_TEST_PASSED';
end;
$$;

select pass('full 3x3 queue, scoring, and post-game flow completed');
select * from finish();

rollback;
