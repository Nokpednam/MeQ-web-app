-- Keep the check-in deadline server-owned while allowing an administrator to
-- adjust the global duration used for newly called teams.

create table public.queue_settings (
  singleton boolean primary key default true check (singleton),
  check_in_duration_seconds integer not null default 180
    check (check_in_duration_seconds between 60 and 600),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.queue_settings(singleton, check_in_duration_seconds)
values(true, 180)
on conflict(singleton) do nothing;

alter table public.queue_settings enable row level security;
create policy queue_settings_read on public.queue_settings
  for select to authenticated using (true);
grant select on public.queue_settings to authenticated;
revoke insert, update, delete on public.queue_settings from public, anon, authenticated;

create or replace function public.admin_set_check_in_duration(p_duration_seconds integer)
returns public.queue_settings language plpgsql security definer set search_path = '' as $$
declare v_setting public.queue_settings;
begin
  if not private.is_admin() then
    raise exception using errcode='42501',message='ADMIN_ONLY';
  end if;
  if p_duration_seconds < 60 or p_duration_seconds > 600 then
    raise exception using errcode='23514',message='INVALID_CHECK_IN_DURATION';
  end if;

  insert into public.queue_settings(singleton,check_in_duration_seconds,updated_by,updated_at)
  values(true,p_duration_seconds,auth.uid(),now())
  on conflict(singleton) do update set
    check_in_duration_seconds=excluded.check_in_duration_seconds,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at
  returning * into v_setting;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload)
  values(auth.uid(),'CHECK_IN_DURATION_CHANGED','queue_setting','global',
    jsonb_build_object('durationSeconds',p_duration_seconds));
  return v_setting;
end;
$$;

create or replace function public.call_next_queue_team(p_court_id text)
returns public.team_check_ins language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.queue_entries;
  v_session public.team_check_ins;
  v_duration_seconds integer;
  v_deadline timestamptz;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  if not exists (select 1 from public.courts where id = p_court_id) then
    raise exception using errcode = 'P0002', message = 'COURT_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext('meq-checkin-' || p_court_id));
  perform private.expire_court_check_ins(p_court_id);

  if exists (select 1 from public.games where court_id = p_court_id
    and status in ('PLAYING','END_REQUESTED','AWAITING_SCORE','VALIDATING_RESULT','INVALID_SCORE')) then
    raise exception using errcode = '23514', message = 'GAME_ALREADY_ACTIVE';
  end if;
  if (select count(*) from public.team_check_ins where court_id = p_court_id and status in ('ACTIVE','READY')) >= 2 then
    raise exception using errcode = '23514', message = 'TWO_TEAMS_ALREADY_CALLED';
  end if;

  select * into v_entry from public.queue_entries
  where court_id = p_court_id and status = 'WAITING'
  order by position, joined_at, id for update skip locked limit 1;
  if v_entry.id is null then
    raise exception using errcode = 'P0002', message = 'NO_WAITING_TEAM';
  end if;

  select check_in_duration_seconds into v_duration_seconds
  from public.queue_settings where singleton=true;
  v_duration_seconds := coalesce(v_duration_seconds,180);
  v_deadline := now() + make_interval(secs => v_duration_seconds);

  update public.queue_entries set status = 'CALLED', position = null, called_at = now(),
    check_in_deadline = v_deadline
  where id = v_entry.id;
  perform private.reorder_court_waiting_queue(p_court_id);

  insert into public.team_check_ins(queue_entry_id, team_id, court_id, deadline)
  values(v_entry.id, v_entry.team_id, p_court_id, v_deadline)
  returning * into v_session;
  return v_session;
end;
$$;

revoke execute on function public.admin_set_check_in_duration(integer) from public, anon;
grant execute on function public.admin_set_check_in_duration(integer) to authenticated;
