begin;
select plan(11);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  id::text || '@location-status.meq.test', '', now(), now(), jsonb_build_object('display_name', display_name)
from (values
  ('41000000-0000-0000-0000-000000000001'::uuid, 'Captain GPS'),
  ('41000000-0000-0000-0000-000000000002'::uuid, 'Member Fresh'),
  ('41000000-0000-0000-0000-000000000003'::uuid, 'Member Expired'),
  ('41000000-0000-0000-0000-000000000004'::uuid, 'Other Team')
) users(id, display_name);

insert into public.teams(id, name, format, captain_user_id)
values
  ('42000000-0000-0000-0000-000000000001', 'GPS Status Team', 'THREE_X_THREE', '41000000-0000-0000-0000-000000000001'),
  ('42000000-0000-0000-0000-000000000002', 'Hidden Team', 'THREE_X_THREE', '41000000-0000-0000-0000-000000000004');
insert into public.team_memberships(team_id, user_id, role)
values
  ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'CAPTAIN'),
  ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'MEMBER'),
  ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 'MEMBER'),
  ('42000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000004', 'CAPTAIN');
insert into public.location_verifications(user_id, court_id, distance_metres, verified_at, expires_at, provider)
values
  ('41000000-0000-0000-0000-000000000001', '3x3-a', 20, now(), now() + interval '10 minutes', 'DEVELOPMENT'),
  ('41000000-0000-0000-0000-000000000003', '3x3-a', 25, now() - interval '11 minutes', now() - interval '1 minute', 'DEVELOPMENT'),
  ('41000000-0000-0000-0000-000000000004', '3x3-a', 15, now(), now() + interval '10 minutes', 'DEVELOPMENT');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
create temporary table status_result as select * from public.get_team_location_status('3x3-a');

select is((select count(*)::integer from status_result), 3, 'returns only the caller team roster');
select is((select count(*)::integer from status_result where is_current_user), 1, 'marks exactly one current user');
select is((select status from status_result where user_id = '41000000-0000-0000-0000-000000000001'), 'VERIFIED', 'fresh verification is ready');
select is((select status from status_result where user_id = '41000000-0000-0000-0000-000000000002'), 'MISSING', 'member without verification is missing');
select is((select status from status_result where user_id = '41000000-0000-0000-0000-000000000003'), 'EXPIRED', 'expired verification is reported expired');
select ok((select expires_at > now() from status_result where user_id = '41000000-0000-0000-0000-000000000001'), 'fresh expiry is returned');
select is((select expires_at is null from status_result where user_id = '41000000-0000-0000-0000-000000000002'), true, 'missing member has no expiry');
select is((select count(*)::integer from status_result where user_id = '41000000-0000-0000-0000-000000000004'), 0, 'does not disclose another team member');
select ok(has_function_privilege('authenticated', 'public.get_team_location_status(text)', 'EXECUTE'), 'authenticated role can execute status RPC');
select ok(not has_function_privilege('anon', 'public.get_team_location_status(text)', 'EXECUTE'), 'anonymous role cannot execute status RPC');
select throws_ok(
  $$select * from public.get_team_location_status('unknown-court')$$,
  'P0002', 'COURT_NOT_FOUND', 'unknown court is rejected'
);

select * from finish();
rollback;
