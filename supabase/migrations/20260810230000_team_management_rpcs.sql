-- Transactional Team Management API. Client code may read team data through
-- RLS, but every mutation is validated again inside PostgreSQL.
create or replace function private.team_roster_locked(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.queue_entries
    where team_id = p_team_id
      and status in (
        'WAITING', 'CALLED', 'CHECKING_IN', 'READY_TO_PLAY', 'PLAYING',
        'AWAITING_SCORE', 'RESTING', 'RETURNING_CHAMPION',
        'DECIDING_REQUEUE', 'DECIDING_CONTINUE'
      )
  );
$$;

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

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values (v_user_id, 'TEAM_CREATED', 'team', v_team.id::text);
  return v_team;
end;
$$;

create or replace function public.add_team_member(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  perform 1 from public.teams where id = p_team_id and dissolved_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'TEAM_NOT_FOUND'; end if;
  if not private.is_team_captain(p_team_id) then raise exception using errcode = '42501', message = 'CAPTAIN_ONLY'; end if;
  if private.team_roster_locked(p_team_id) then raise exception using errcode = '23514', message = 'ROSTER_LOCKED'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
  end if;
  if exists (select 1 from public.team_memberships where user_id = p_user_id and left_at is null) then
    raise exception using errcode = '23505', message = 'USER_ALREADY_IN_TEAM';
  end if;
  insert into public.team_memberships(team_id, user_id, role) values (p_team_id, p_user_id, 'MEMBER');
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (v_actor, 'TEAM_MEMBER_ADDED', 'team', p_team_id::text, jsonb_build_object('userId', p_user_id));
end;
$$;

create or replace function public.remove_team_member(p_team_id uuid, p_user_id uuid)
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
  if v_actor = p_user_id then raise exception using errcode = '23514', message = 'CAPTAIN_CANNOT_REMOVE_SELF'; end if;
  if private.team_roster_locked(p_team_id) then raise exception using errcode = '23514', message = 'ROSTER_LOCKED'; end if;
  update public.team_memberships set left_at = now()
  where team_id = p_team_id and user_id = p_user_id and left_at is null and role = 'MEMBER';
  if not found then raise exception using errcode = 'P0002', message = 'USER_NOT_MEMBER'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (v_actor, 'TEAM_MEMBER_REMOVED', 'team', p_team_id::text, jsonb_build_object('userId', p_user_id));
end;
$$;

create or replace function public.transfer_team_captain(p_team_id uuid, p_user_id uuid)
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
  if v_actor = p_user_id then raise exception using errcode = '23514', message = 'CAPTAIN_CANNOT_REMOVE_SELF'; end if;
  if private.team_roster_locked(p_team_id) then raise exception using errcode = '23514', message = 'ROSTER_LOCKED'; end if;
  if not exists (select 1 from public.team_memberships where team_id = p_team_id and user_id = p_user_id and left_at is null) then
    raise exception using errcode = 'P0002', message = 'USER_NOT_MEMBER';
  end if;
  update public.team_memberships set role = 'MEMBER'
    where team_id = p_team_id and user_id = v_actor and left_at is null;
  update public.team_memberships set role = 'CAPTAIN'
    where team_id = p_team_id and user_id = p_user_id and left_at is null;
  update public.teams set captain_user_id = p_user_id, updated_at = now() where id = p_team_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (v_actor, 'TEAM_CAPTAIN_TRANSFERRED', 'team', p_team_id::text, jsonb_build_object('newCaptainUserId', p_user_id));
end;
$$;

create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  perform 1 from public.teams where id = p_team_id and dissolved_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'TEAM_NOT_FOUND'; end if;
  if private.is_team_captain(p_team_id) then raise exception using errcode = '23514', message = 'CAPTAIN_CANNOT_LEAVE'; end if;
  if private.team_roster_locked(p_team_id) then raise exception using errcode = '23514', message = 'ROSTER_LOCKED'; end if;
  update public.team_memberships set left_at = now()
  where team_id = p_team_id and user_id = v_actor and left_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'USER_NOT_MEMBER'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values (v_actor, 'TEAM_LEFT', 'team', p_team_id::text);
end;
$$;

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
  update public.teams set dissolved_at = now(), updated_at = now() where id = p_team_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values (v_actor, 'TEAM_DISSOLVED', 'team', p_team_id::text);
end;
$$;

revoke execute on function private.team_roster_locked(uuid) from public, anon, authenticated;
revoke execute on function public.create_team(text, public.team_format) from public, anon;
revoke execute on function public.add_team_member(uuid, uuid) from public, anon;
revoke execute on function public.remove_team_member(uuid, uuid) from public, anon;
revoke execute on function public.transfer_team_captain(uuid, uuid) from public, anon;
revoke execute on function public.leave_team(uuid) from public, anon;
revoke execute on function public.dissolve_team(uuid) from public, anon;
grant execute on function public.create_team(text, public.team_format) to authenticated;
grant execute on function public.add_team_member(uuid, uuid) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_team_captain(uuid, uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.dissolve_team(uuid) to authenticated;
