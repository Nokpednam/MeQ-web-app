-- Team invitations keep roster membership opt-in while preserving the
-- existing transactional team constraints.
create type public.team_invitation_status as enum (
  'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id),
  invited_by_user_id uuid not null references public.profiles(id),
  status public.team_invitation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (invited_user_id <> invited_by_user_id)
);

create unique index one_pending_invitation_per_team_user
  on public.team_invitations(team_id, invited_user_id)
  where status = 'PENDING';
create index team_invitations_invitee_status
  on public.team_invitations(invited_user_id, status, created_at desc);
create index team_invitations_team_status
  on public.team_invitations(team_id, status, created_at desc);

alter table public.team_invitations enable row level security;

create policy team_invitations_participant_read
on public.team_invitations for select to authenticated
using (
  invited_user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams
    where teams.id = team_invitations.team_id
      and teams.captain_user_id = (select auth.uid())
      and teams.dissolved_at is null
  )
);

grant select on public.team_invitations to authenticated;
revoke insert, update, delete on public.team_invitations from anon, authenticated;

create or replace function public.invite_team_member(p_team_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation_id uuid;
  v_team public.teams;
  v_capacity integer;
  v_member_count integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if v_actor = p_user_id then
    raise exception using errcode = '23514', message = 'CANNOT_INVITE_SELF';
  end if;

  -- The profile lock serializes invitations against joining or creating a
  -- team with the same user account.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
  end if;

  select * into v_team from public.teams
  where id = p_team_id and dissolved_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TEAM_NOT_FOUND';
  end if;
  if not private.is_team_captain(p_team_id) then
    raise exception using errcode = '42501', message = 'CAPTAIN_ONLY';
  end if;
  if private.team_roster_locked(p_team_id) then
    raise exception using errcode = '23514', message = 'ROSTER_LOCKED';
  end if;
  v_capacity := case v_team.format when 'THREE_X_THREE' then 3 else 5 end;
  select count(*) into v_member_count
  from public.team_memberships
  where team_id = p_team_id and left_at is null;
  if v_member_count >= v_capacity then
    raise exception using errcode = '23514', message = 'TEAM_FULL';
  end if;
  if exists (
    select 1 from public.team_memberships
    where user_id = p_user_id and left_at is null
  ) then
    raise exception using errcode = '23505', message = 'USER_ALREADY_IN_TEAM';
  end if;
  if exists (
    select 1 from public.team_invitations
    where team_id = p_team_id
      and invited_user_id = p_user_id
      and status = 'PENDING'
  ) then
    raise exception using errcode = '23505', message = 'INVITATION_ALREADY_PENDING';
  end if;

  insert into public.team_invitations(team_id, invited_user_id, invited_by_user_id)
  values (p_team_id, p_user_id, v_actor)
  returning id into v_invitation_id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (
    v_actor,
    'TEAM_INVITATION_SENT',
    'team_invitation',
    v_invitation_id::text,
    jsonb_build_object('teamId', p_team_id, 'invitedUserId', p_user_id)
  );

  return v_invitation_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'INVITATION_ALREADY_PENDING';
end;
$$;

create or replace function public.accept_team_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.team_invitations;
  v_team public.teams;
  v_capacity integer;
  v_member_count integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  -- Serializes concurrent acceptance attempts made by the same user.
  perform 1 from public.profiles where id = v_actor for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
  end if;

  -- Read the team id first, then lock in profile -> team -> invitation order.
  -- Dissolving a team locks team -> invitation, so this avoids a lock cycle.
  select * into v_invitation
  from public.team_invitations
  where id = p_invitation_id and invited_user_id = v_actor;
  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;
  if v_invitation.status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'INVITATION_NOT_PENDING';
  end if;

  select * into v_team
  from public.teams
  where id = v_invitation.team_id and dissolved_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TEAM_NOT_FOUND';
  end if;

  select * into v_invitation
  from public.team_invitations
  where id = p_invitation_id and invited_user_id = v_actor
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;
  if v_invitation.status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'INVITATION_NOT_PENDING';
  end if;
  if private.team_roster_locked(v_team.id) then
    raise exception using errcode = '23514', message = 'ROSTER_LOCKED';
  end if;
  if exists (
    select 1 from public.team_memberships
    where user_id = v_actor and left_at is null
  ) then
    raise exception using errcode = '23505', message = 'USER_ALREADY_IN_TEAM';
  end if;

  v_capacity := case v_team.format when 'THREE_X_THREE' then 3 else 5 end;
  select count(*) into v_member_count
  from public.team_memberships
  where team_id = v_team.id and left_at is null;
  if v_member_count >= v_capacity then
    raise exception using errcode = '23514', message = 'TEAM_FULL';
  end if;

  insert into public.team_memberships(team_id, user_id, role)
  values (v_team.id, v_actor, 'MEMBER');

  update public.team_invitations
  set status = 'ACCEPTED', responded_at = now()
  where id = v_invitation.id;

  -- Joining one team invalidates every other invitation for this user.
  update public.team_invitations
  set status = 'CANCELLED', responded_at = now()
  where invited_user_id = v_actor
    and status = 'PENDING';

  -- Multiple people may be invited, but once the roster fills no pending
  -- invitation for the team can remain actionable.
  if v_member_count + 1 >= v_capacity then
    update public.team_invitations
    set status = 'CANCELLED', responded_at = now()
    where team_id = v_team.id
      and status = 'PENDING';
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (
    v_actor,
    'TEAM_INVITATION_ACCEPTED',
    'team_invitation',
    v_invitation.id::text,
    jsonb_build_object('teamId', v_team.id)
  );

  return v_team.id;
end;
$$;

create or replace function public.decline_team_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.team_invitations;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_invitation
  from public.team_invitations
  where id = p_invitation_id and invited_user_id = v_actor
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;
  if v_invitation.status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'INVITATION_NOT_PENDING';
  end if;

  update public.team_invitations
  set status = 'DECLINED', responded_at = now()
  where id = v_invitation.id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (
    v_actor,
    'TEAM_INVITATION_DECLINED',
    'team_invitation',
    v_invitation.id::text,
    jsonb_build_object('teamId', v_invitation.team_id)
  );
end;
$$;

create or replace function public.cancel_team_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.team_invitations;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_invitation
  from public.team_invitations
  where id = p_invitation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;
  if not private.is_team_captain(v_invitation.team_id) then
    raise exception using errcode = '42501', message = 'CAPTAIN_ONLY';
  end if;
  if v_invitation.status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'INVITATION_NOT_PENDING';
  end if;

  update public.team_invitations
  set status = 'CANCELLED', responded_at = now()
  where id = v_invitation.id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (
    v_actor,
    'TEAM_INVITATION_CANCELLED',
    'team_invitation',
    v_invitation.id::text,
    jsonb_build_object('teamId', v_invitation.team_id, 'invitedUserId', v_invitation.invited_user_id)
  );
end;
$$;

-- Creating a team means the user can no longer accept invitations elsewhere.
create or replace function public.create_team(p_name text, p_format public.team_format)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_team public.teams;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id = v_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 30 then
    raise exception using errcode = '23514', message = 'TEAM_NAME_LENGTH';
  end if;
  if exists (select 1 from public.team_memberships where user_id = v_user_id and left_at is null) then
    raise exception using errcode = '23505', message = 'USER_ALREADY_IN_TEAM';
  end if;

  insert into public.teams(name, format, captain_user_id)
  values (v_name, p_format, v_user_id)
  returning * into v_team;

  insert into public.team_memberships(team_id, user_id, role)
  values (v_team.id, v_user_id, 'CAPTAIN');

  update public.team_invitations
  set status = 'CANCELLED', responded_at = now()
  where invited_user_id = v_user_id and status = 'PENDING';

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values (v_user_id, 'TEAM_CREATED', 'team', v_team.id::text);
  return v_team;
end;
$$;

-- Dissolving a team also closes invitations that can no longer be accepted.
create or replace function public.dissolve_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  perform 1 from public.teams where id = p_team_id and dissolved_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'TEAM_NOT_FOUND'; end if;
  if not private.is_team_captain(p_team_id) then raise exception using errcode = '42501', message = 'CAPTAIN_ONLY'; end if;
  if private.team_roster_locked(p_team_id) then raise exception using errcode = '23514', message = 'ROSTER_LOCKED'; end if;
  update public.team_memberships set left_at = now() where team_id = p_team_id and left_at is null;
  update public.team_invitations
  set status = 'CANCELLED', responded_at = now()
  where team_id = p_team_id and status = 'PENDING';
  update public.teams set dissolved_at = now(), updated_at = now() where id = p_team_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values (v_actor, 'TEAM_DISSOLVED', 'team', p_team_id::text);
end;
$$;

-- Direct membership insertion is retained for administrative/test setup only.
revoke execute on function public.add_team_member(uuid, uuid) from authenticated;

revoke execute on function public.invite_team_member(uuid, uuid) from public, anon;
revoke execute on function public.accept_team_invitation(uuid) from public, anon;
revoke execute on function public.decline_team_invitation(uuid) from public, anon;
revoke execute on function public.cancel_team_invitation(uuid) from public, anon;
grant execute on function public.invite_team_member(uuid, uuid) to authenticated;
grant execute on function public.accept_team_invitation(uuid) to authenticated;
grant execute on function public.decline_team_invitation(uuid) to authenticated;
grant execute on function public.cancel_team_invitation(uuid) to authenticated;
