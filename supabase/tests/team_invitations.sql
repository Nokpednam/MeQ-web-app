begin;
select plan(1);

do $$
declare
  captain_id uuid := '16000000-0000-0000-0000-000000000001';
  member_a_id uuid := '16000000-0000-0000-0000-000000000002';
  member_b_id uuid := '16000000-0000-0000-0000-000000000003';
  extra_id uuid := '16000000-0000-0000-0000-000000000004';
  other_captain_id uuid := '16000000-0000-0000-0000-000000000005';
  decline_id uuid := '16000000-0000-0000-0000-000000000006';
  team_row public.teams;
  other_team public.teams;
  invite_a uuid;
  invite_b uuid;
  invite_extra uuid;
  invite_other uuid;
  invite_decline uuid;
  invite_cancel uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  values
    (captain_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invite-captain@meq.test', '', now(), now(), '{"display_name":"Invite Captain"}'),
    (member_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invite-a@meq.test', '', now(), now(), '{"display_name":"Invite A"}'),
    (member_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invite-b@meq.test', '', now(), now(), '{"display_name":"Invite B"}'),
    (extra_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invite-extra@meq.test', '', now(), now(), '{"display_name":"Invite Extra"}'),
    (other_captain_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invite-other-captain@meq.test', '', now(), now(), '{"display_name":"Other Captain"}'),
    (decline_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invite-decline@meq.test', '', now(), now(), '{"display_name":"Invite Decline"}');

  perform set_config('request.jwt.claim.sub', captain_id::text, true);
  team_row := public.create_team('Invitation QA', 'THREE_X_THREE');
  invite_a := public.invite_team_member(team_row.id, member_a_id);
  invite_b := public.invite_team_member(team_row.id, member_b_id);
  invite_extra := public.invite_team_member(team_row.id, extra_id);
  invite_decline := public.invite_team_member(team_row.id, decline_id);

  begin
    perform public.invite_team_member(team_row.id, member_a_id);
    raise exception 'duplicate pending invitation was allowed';
  exception when unique_violation then
    if sqlerrm <> 'INVITATION_ALREADY_PENDING' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', other_captain_id::text, true);
  other_team := public.create_team('Other Invitation QA', 'FIVE_X_FIVE');
  invite_other := public.invite_team_member(other_team.id, member_a_id);

  perform set_config('request.jwt.claim.sub', member_a_id::text, true);
  perform public.accept_team_invitation(invite_a);
  if not exists (
    select 1 from public.team_memberships
    where team_id = team_row.id and user_id = member_a_id and left_at is null
  ) then
    raise exception 'accepted invitation did not create membership';
  end if;
  if (select status from public.team_invitations where id = invite_other) <> 'CANCELLED' then
    raise exception 'acceptance did not cancel the user''s other invitation';
  end if;

  perform set_config('request.jwt.claim.sub', decline_id::text, true);
  perform public.decline_team_invitation(invite_decline);
  if (select status from public.team_invitations where id = invite_decline) <> 'DECLINED' then
    raise exception 'declined invitation remained pending';
  end if;

  perform set_config('request.jwt.claim.sub', captain_id::text, true);
  invite_cancel := public.invite_team_member(team_row.id, decline_id);
  perform public.cancel_team_invitation(invite_cancel);
  if (select status from public.team_invitations where id = invite_cancel) <> 'CANCELLED' then
    raise exception 'captain cancellation left an invitation pending';
  end if;

  perform set_config('request.jwt.claim.sub', member_b_id::text, true);
  perform public.accept_team_invitation(invite_b);
  if (select status from public.team_invitations where id = invite_extra) <> 'CANCELLED' then
    raise exception 'full roster did not cancel remaining team invitations';
  end if;

  begin
    perform set_config('request.jwt.claim.sub', extra_id::text, true);
    perform public.accept_team_invitation(invite_extra);
    raise exception 'cancelled invitation was accepted';
  exception when check_violation then
    if sqlerrm <> 'INVITATION_NOT_PENDING' then raise; end if;
  end;

  raise notice 'TEAM_INVITATION_TESTS_PASSED';
end;
$$;

select pass('team invitation flow completed');
select * from finish();
rollback;
