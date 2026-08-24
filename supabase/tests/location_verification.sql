begin;
select plan(7);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'location@meq.test', '', now(), now(),
  '{"display_name":"Location QA"}'::jsonb);
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.verify_court_location('3x3-a', 16.7421898, 100.1934578, 10)$$,
  'location at the configured test point is accepted'
);
select is((select count(*)::integer from public.location_verifications
  where user_id = '40000000-0000-0000-0000-000000000001' and court_id = '3x3-a'), 1,
  'verification is stored for the authenticated user');
select ok((select expires_at > now() + interval '9 minutes' from public.location_verifications
  where user_id = '40000000-0000-0000-0000-000000000001' and court_id = '3x3-a'),
  'verification lasts approximately ten minutes');
select throws_ok(
  $$select public.verify_court_location('3x3-a', 16.7521898, 100.1934578, 10)$$,
  '23514', 'OUT_OF_RANGE', 'out-of-range coordinates are rejected'
);
select throws_ok(
  $$select public.verify_court_location('3x3-a', 16.7421898, 100.1934578, 151)$$,
  '22023', 'LOCATION_ACCURACY_TOO_LOW', 'inaccurate browser readings are rejected'
);
select throws_ok(
  $$select public.verify_court_location('3x3-a', 91, 100.1934578, 10)$$,
  '22023', 'INVALID_COORDINATES', 'invalid coordinates are rejected'
);
select ok(has_function_privilege('authenticated',
  'public.verify_court_location(text,double precision,double precision,double precision)', 'EXECUTE'),
  'authenticated users can execute the verification RPC');

select * from finish();
rollback;

