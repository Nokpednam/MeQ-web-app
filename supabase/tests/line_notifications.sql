begin;
select plan(3);

select ok(
  not has_function_privilege('authenticated', 'public.claim_line_notifications(integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.claim_line_notifications(integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_line_notification(uuid, text, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.claim_line_notifications(integer)', 'EXECUTE'),
  'only the service role can claim and complete LINE notifications'
);

select ok(
  not has_table_privilege('authenticated', 'public.line_notifications', 'SELECT')
  and not has_table_privilege('anon', 'public.line_notifications', 'SELECT'),
  'LINE notification outbox is not readable by clients'
);

do $$
declare
  admin_id uuid := '18000000-0000-0000-0000-000000000001';
  reporter_id uuid := '18000000-0000-0000-0000-000000000002';
  player_id uuid := '18000000-0000-0000-0000-000000000003';
  no_line_id uuid := '18000000-0000-0000-0000-000000000004';
  report public.maintenance_reports;
  team_id uuid;
  entry_id uuid;
  claimed record;
  claimed_count integer;
  other_team_id uuid;
  game_id uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'line-admin@meq.test', '', now(), now(), '{"display_name":"Line Admin"}'),
    (reporter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'line-reporter@meq.test', '', now(), now(), '{"display_name":"Line Reporter"}'),
    (player_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'line-player@meq.test', '', now(), now(), '{"display_name":"Line Player"}'),
    (no_line_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'no-line@meq.test', '', now(), now(), '{"display_name":"No Line"}');
  update public.profiles set role = 'ADMIN' where id = admin_id;

  insert into auth.identities(id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  values
    (gen_random_uuid(), admin_id, 'Uadmin000000000000000000000000001', 'custom:line', '{"sub":"Uadmin000000000000000000000000001"}', now(), now()),
    (gen_random_uuid(), reporter_id, 'Ureporter0000000000000000000000002', 'custom:line', '{"sub":"Ureporter0000000000000000000000002"}', now(), now()),
    (gen_random_uuid(), player_id, 'Uplayer000000000000000000000000003', 'custom:line', '{"sub":"Uplayer000000000000000000000000003"}', now(), now());

  -- New report notifies admins only.
  perform set_config('request.jwt.claim.sub', reporter_id::text, true);
  report := public.create_maintenance_report('5x5', 'LIGHTING', 'ไฟสนามดับทดสอบแจ้งเตือน', null);
  if not exists (
    select 1 from public.line_notifications
    where recipient_user_id = admin_id and kind = 'MAINTENANCE_NEW' and message like '%ระบบไฟ%'
  ) then
    raise exception 'admin was not notified about a new report';
  end if;
  if exists (select 1 from public.line_notifications where recipient_user_id = reporter_id) then
    raise exception 'reporter was notified about their own new report';
  end if;

  -- Status change notifies the reporter, including the admin note.
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_update_maintenance_status(report.id, 'WAITING_FOR_CARETAKER', 'โทรแจ้งผู้ดูแลแล้ว');
  if not exists (
    select 1 from public.line_notifications
    where recipient_user_id = reporter_id and kind = 'MAINTENANCE_STATUS'
      and message like '%รอเข้ามาซ่อม%' and message like '%โทรแจ้งผู้ดูแลแล้ว%'
  ) then
    raise exception 'reporter was not notified about the status change';
  end if;

  -- Reports waiting too long remind admins once per day.
  update public.maintenance_reports set updated_at = now() - interval '3 days' where id = report.id;
  perform private.enqueue_maintenance_waiting_reminders();
  perform private.enqueue_maintenance_waiting_reminders();
  if (select count(*) from public.line_notifications
      where recipient_user_id = admin_id and kind = 'MAINTENANCE_WAITING_REMINDER') <> 1 then
    raise exception 'waiting reminder should be queued exactly once per admin per day';
  end if;

  -- Calling a team notifies every current member.
  insert into public.teams(name, format, captain_user_id)
  values ('ทีมทดสอบไลน์', 'FIVE_X_FIVE', player_id)
  returning id into team_id;
  insert into public.team_memberships(team_id, user_id, role)
  values (team_id, player_id, 'CAPTAIN'), (team_id, no_line_id, 'MEMBER');
  insert into public.queue_entries(court_id, team_id, position)
  values ('5x5', team_id, 1)
  returning id into entry_id;
  update public.queue_entries
  set status = 'CALLED', position = null, called_at = now(), check_in_deadline = now() + interval '3 minutes'
  where id = entry_id;

  if (select count(*) from public.line_notifications where kind = 'QUEUE_NEXT') <> 2 then
    raise exception 'joining the queue at position 1 should notify every member once';
  end if;
  if (select count(*) from public.line_notifications where kind = 'QUEUE_CALLED') <> 2 then
    raise exception 'every team member should get a queue-called notification';
  end if;
  if not exists (
    select 1 from public.line_notifications
    where recipient_user_id = player_id and kind = 'QUEUE_CALLED'
      and message like '%ทีมทดสอบไลน์%' and link_path = '/courts/5x5'
  ) then
    raise exception 'queue-called message is missing team name or court link';
  end if;

  -- An already expired message is never sent.
  update public.line_notifications set expires_at = now() - interval '1 minute'
  where kind = 'MAINTENANCE_WAITING_REMINDER';

  -- Claim as the dispatcher.
  claimed_count := 0;
  for claimed in select * from public.claim_line_notifications(50) loop
    claimed_count := claimed_count + 1;
    if claimed.line_user_id is null or claimed.line_user_id not like 'U%' then
      raise exception 'claimed notification is missing the LINE user id';
    end if;
    if claimed.attempts <> 1 then
      raise exception 'claim should count one attempt';
    end if;
  end loop;
  if claimed_count <> 4 then
    raise exception 'expected 4 claimable notifications, got %', claimed_count;
  end if;
  if exists (select 1 from public.line_notifications
      where recipient_user_id = no_line_id and status <> 'SKIPPED') then
    raise exception 'member without LINE identity should be skipped';
  end if;
  if (select status from public.line_notifications
      where kind = 'MAINTENANCE_WAITING_REMINDER') <> 'EXPIRED' then
    raise exception 'expired notification should not be claimed';
  end if;
  if exists (select 1 from public.claim_line_notifications(50)) then
    raise exception 'claimed notifications must not be claimed twice';
  end if;

  -- Completion outcomes.
  perform public.complete_line_notification(
    (select id from public.line_notifications where kind = 'MAINTENANCE_NEW'), 'SENT', null);
  perform public.complete_line_notification(
    (select id from public.line_notifications where kind = 'MAINTENANCE_STATUS'), 'RETRY', 'HTTP_500');
  perform public.complete_line_notification(
    (select id from public.line_notifications where kind = 'QUEUE_CALLED' and recipient_user_id = player_id), 'FAILED', 'HTTP_400');

  if (select status from public.line_notifications where kind = 'MAINTENANCE_NEW') <> 'SENT'
    or (select sent_at from public.line_notifications where kind = 'MAINTENANCE_NEW') is null then
    raise exception 'sent notification was not marked SENT';
  end if;
  if (select status from public.line_notifications where kind = 'MAINTENANCE_STATUS') <> 'PENDING' then
    raise exception 'retryable failure should return to PENDING';
  end if;
  if (select status from public.line_notifications
      where kind = 'QUEUE_CALLED' and recipient_user_id = player_id) <> 'FAILED' then
    raise exception 'permanent failure should be FAILED';
  end if;

  -- Retries stop after three attempts.
  perform public.claim_line_notifications(50);
  perform public.complete_line_notification(
    (select id from public.line_notifications where kind = 'MAINTENANCE_STATUS'), 'RETRY', 'HTTP_500');
  perform public.claim_line_notifications(50);
  perform public.complete_line_notification(
    (select id from public.line_notifications where kind = 'MAINTENANCE_STATUS'), 'RETRY', 'HTTP_500');
  if (select status from public.line_notifications where kind = 'MAINTENANCE_STATUS') <> 'FAILED' then
    raise exception 'notification should fail after three attempts';
  end if;

  -- Messages are plain text without emoji.
  if exists (select 1 from public.line_notifications where message ~ '[🌀-🫿☀-➿]') then
    raise exception 'LINE messages should not contain emoji';
  end if;

  -- Team invitation notifies the invitee.
  insert into public.teams(name, format, captain_user_id)
  values ('ทีมคู่แข่งไลน์', 'FIVE_X_FIVE', reporter_id)
  returning id into other_team_id;
  insert into public.team_memberships(team_id, user_id, role) values (other_team_id, reporter_id, 'CAPTAIN');
  insert into public.team_invitations(team_id, invited_user_id, invited_by_user_id)
  values (other_team_id, admin_id, reporter_id);
  if not exists (
    select 1 from public.line_notifications
    where recipient_user_id = admin_id and kind = 'TEAM_INVITATION'
      and message like 'Line Reporter เชิญคุณเข้าร่วมทีม ทีมคู่แข่งไลน์ (5x5)%' and link_path = '/teams'
  ) then
    raise exception 'invitee was not notified';
  end if;

  -- Completed game notifies every rostered player with their own result.
  update public.queue_entries set status = 'CANCELLED', position = null, closed_at = now() where id = entry_id;
  insert into public.games(court_id, team_a_id, team_b_id, target_score)
  values ('5x5', team_id, other_team_id, 11)
  returning id into game_id;
  insert into public.game_roster_snapshots(game_id, team_id, user_id, display_name, is_captain)
  values (game_id, team_id, player_id, 'Line Player', true),
         (game_id, other_team_id, reporter_id, 'Line Reporter', true);
  update public.games
  set status = 'COMPLETED', winner_team_id = team_id, loser_team_id = other_team_id,
      final_team_a_score = 11, final_team_b_score = 8, completed_at = now()
  where id = game_id;
  if not exists (
    select 1 from public.line_notifications
    where recipient_user_id = player_id and kind = 'GAME_RESULT'
      and message like '%ทีมทดสอบไลน์ 11 - 8 ทีมคู่แข่งไลน์%' and message like '%ทีมของคุณชนะ'
  ) or not exists (
    select 1 from public.line_notifications
    where recipient_user_id = reporter_id and kind = 'GAME_RESULT' and message like '%ทีมของคุณแพ้'
  ) then
    raise exception 'game result was not sent to both teams with the right outcome';
  end if;

  raise notice 'LINE_NOTIFICATION_TESTS_PASSED';
end;
$$;

select pass('LINE notification enqueue, claim, and completion flow completed');
select * from finish();
rollback;
