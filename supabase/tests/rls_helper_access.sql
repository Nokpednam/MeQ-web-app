-- Signed-in users read their statistics and game scores through RLS. The other
-- tests run as postgres, which bypasses RLS and function privileges, so they
-- missed that the policies' helper functions were not executable by
-- authenticated users.
begin;
select plan(9);

update public.courts set is_open = true, opens_at = '00:00';

do $$
declare
  a1 uuid := '42000000-0000-0000-0000-000000000001';
  a2 uuid := '42000000-0000-0000-0000-000000000002';
  a3 uuid := '42000000-0000-0000-0000-000000000003';
  b1 uuid := '42000000-0000-0000-0000-000000000004';
  b2 uuid := '42000000-0000-0000-0000-000000000005';
  b3 uuid := '42000000-0000-0000-0000-000000000006';
  team_a public.teams;
  team_b public.teams;
  check_a uuid;
  check_b uuid;
  v_game uuid;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at,raw_user_meta_data)
  select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',id::text||'@rls.meq.test','',now(),now(),jsonb_build_object('display_name','RLS QA')
  from unnest(array[a1,a2,a3,b1,b2,b3]) id;

  perform set_config('request.jwt.claim.sub',a1::text,true);
  team_a:=public.create_team('RLS Alpha','THREE_X_THREE');
  perform public.add_team_member(team_a.id,a2);
  perform public.add_team_member(team_a.id,a3);
  perform set_config('request.jwt.claim.sub',b1::text,true);
  team_b:=public.create_team('RLS Beta','THREE_X_THREE');
  perform public.add_team_member(team_b.id,b2);
  perform public.add_team_member(team_b.id,b3);

  insert into public.location_verifications(user_id,court_id,distance_metres,expires_at,provider)
  select id,'3x3-a',10,now()+interval '30 minutes','DEVELOPMENT' from unnest(array[a1,a2,a3,b1,b2,b3]) id;
  perform set_config('request.jwt.claim.sub',a1::text,true); perform public.join_court_queue('3x3-a');
  perform set_config('request.jwt.claim.sub',b1::text,true); perform public.join_court_queue('3x3-a');

  update public.profiles set role='ADMIN' where id=a1;
  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.call_next_queue_team('3x3-a');
  perform public.call_next_queue_team('3x3-a');
  select id into check_a from public.team_check_ins where team_id=team_a.id and status='ACTIVE';
  select id into check_b from public.team_check_ins where team_id=team_b.id and status='ACTIVE';
  perform public.confirm_team_ready(check_a);
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.confirm_team_ready(check_b);
  select id into v_game from public.games where court_id='3x3-a' and status='PLAYING';
  perform set_config('request.jwt.claim.sub',a1::text,true);
  perform public.request_game_end(v_game);
  perform public.submit_team_scores(v_game,jsonb_build_object(a1::text,5,a2::text,2,a3::text,0));
  perform set_config('request.jwt.claim.sub',b1::text,true);
  perform public.submit_team_scores(v_game,jsonb_build_object(b1::text,3,b2::text,0,b3::text,0));
end;
$$;

-- Read as a signed-in player of the losing team, as the Data API does.
set local role authenticated;
select set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"42000000-0000-0000-0000-000000000005","role":"authenticated"}',true);

select lives_ok($$select count(*) from public.player_game_history$$, 'a player can query player_game_history');
select is((select count(*)::int from public.player_game_history), 1, 'a player sees only their own history row');
select is((select won from public.player_game_history limit 1), false, 'the losing player''s history records the loss');
select is((select count(*)::int from public.player_scores), 6, 'a player sees every score of a completed game');
select lives_ok($$select count(*) from public.score_submissions$$, 'a player can query score submissions');
select is((select count(*)::int from public.audit_logs), 0, 'a non-admin sees no audit logs');
select lives_ok($$select count(*) from public.maintenance_reports$$, 'a player can query maintenance reports');

-- Read as the administrator.
select set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"42000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from public.player_game_history), 6, 'an admin sees every history row');
select ok((select count(*) from public.audit_logs) > 0, 'an admin sees audit logs');

reset role;
select * from finish();
rollback;
