-- Server-authoritative browser location verification. The faculty coordinates
-- are temporary test values and can be replaced without changing application code.

alter table public.courts
  add column if not exists location_radius_metres integer not null default 300
    check (location_radius_metres between 10 and 5000);

update public.courts
set latitude = 16.7421898,
    longitude = 100.1934578,
    location_radius_metres = 300
where id in ('3x3-a', '3x3-b', '5x5');

alter table public.location_verifications
  drop constraint if exists location_verifications_provider_check;
alter table public.location_verifications
  add constraint location_verifications_provider_check
  check (provider in ('BROWSER_GEOLOCATION', 'EDGE_GEOLOCATION', 'DEVELOPMENT'));

create or replace function public.verify_court_location(
  p_court_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_metres double precision
)
returns table(distance_metres numeric, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_court public.courts;
  v_distance double precision;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception using errcode = '22023', message = 'INVALID_COORDINATES';
  end if;
  if p_accuracy_metres is null or p_accuracy_metres < 0 or p_accuracy_metres > 150 then
    raise exception using errcode = '22023', message = 'LOCATION_ACCURACY_TOO_LOW';
  end if;

  select * into v_court from public.courts where id = p_court_id;
  if v_court.id is null then
    raise exception using errcode = 'P0002', message = 'COURT_NOT_FOUND';
  end if;
  if v_court.latitude is null or v_court.longitude is null then
    raise exception using errcode = '23514', message = 'COURT_LOCATION_NOT_CONFIGURED';
  end if;

  v_distance := 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_latitude - v_court.latitude) / 2), 2) +
    cos(radians(v_court.latitude)) * cos(radians(p_latitude)) *
    power(sin(radians(p_longitude - v_court.longitude) / 2), 2)
  ));

  if v_distance + p_accuracy_metres > v_court.location_radius_metres then
    raise exception using errcode = '23514', message = 'OUT_OF_RANGE';
  end if;

  delete from public.location_verifications
  where user_id = v_user_id and court_id = p_court_id;

  insert into public.location_verifications(
    user_id, court_id, distance_metres, expires_at, provider
  ) values (
    v_user_id, p_court_id, round(v_distance::numeric, 2), v_expires_at,
    'BROWSER_GEOLOCATION'
  );

  return query select round(v_distance::numeric, 2), v_expires_at;
end;
$$;

create or replace function public.join_court_queue(p_court_id text)
returns public.queue_entries language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_team public.teams;
  v_court public.courts;
  v_entry public.queue_entries;
  v_roster_count integer;
  v_next_position bigint;
  v_now_bangkok time := (now() at time zone 'Asia/Bangkok')::time;
begin
  if v_user_id is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  select * into v_team from public.teams
    where captain_user_id = v_user_id and dissolved_at is null for update;
  if v_team.id is null then raise exception using errcode='42501', message='CAPTAIN_ONLY'; end if;
  select * into v_court from public.courts where id = p_court_id for update;
  if v_court.id is null then raise exception using errcode='P0002', message='COURT_NOT_FOUND'; end if;
  if not v_court.is_open or v_now_bangkok < v_court.opens_at then
    raise exception using errcode='23514', message='COURT_CLOSED';
  end if;
  if (v_team.format = 'THREE_X_THREE' and v_court.required_members <> 3)
    or (v_team.format = 'FIVE_X_FIVE' and v_court.required_members <> 5) then
    raise exception using errcode='23514', message='INCOMPATIBLE_COURT';
  end if;
  select count(*) into v_roster_count from public.team_memberships
    where team_id = v_team.id and left_at is null;
  if v_roster_count <> v_court.required_members then
    raise exception using errcode='23514', message='TEAM_INCOMPLETE';
  end if;
  if exists (select 1 from public.active_queue_players aqp
    join public.team_memberships tm on tm.user_id = aqp.user_id
    where tm.team_id = v_team.id and tm.left_at is null) then
    raise exception using errcode='23505', message='PLAYER_ALREADY_ACTIVE';
  end if;
  if exists (select 1 from public.court_event_courts cec
    join public.court_events ce on ce.id = cec.event_id
    where cec.court_id = p_court_id and ce.cancelled_at is null
      and now() >= ce.starts_at and now() < ce.ends_at) then
    raise exception using errcode='23514', message='COURT_EVENT_ACTIVE';
  end if;
  if exists (select 1 from public.team_memberships tm
    where tm.team_id = v_team.id and tm.left_at is null and not exists (
      select 1 from public.location_verifications lv
      where lv.user_id = tm.user_id and lv.court_id = p_court_id
        and lv.distance_metres <= v_court.location_radius_metres
        and lv.expires_at > now()
    )) then
    raise exception using errcode='23514', message='LOCATION_VERIFICATION_REQUIRED';
  end if;
  select coalesce(max(position), 0) + 1 into v_next_position
    from public.queue_entries where court_id = p_court_id
      and status in ('WAITING','CALLED','CHECKING_IN','READY_TO_PLAY','RETURNING_CHAMPION');
  insert into public.queue_entries(court_id, team_id, position)
    values (p_court_id, v_team.id, v_next_position) returning * into v_entry;
  insert into public.active_queue_players(user_id, queue_entry_id, court_id, team_id)
    select user_id, v_entry.id, p_court_id, v_team.id from public.team_memberships
    where team_id = v_team.id and left_at is null;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
    values (v_user_id, 'QUEUE_JOINED', 'queue_entry', v_entry.id::text);
  return v_entry;
end;
$$;

revoke execute on function public.verify_court_location(text, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.verify_court_location(text, double precision, double precision, double precision)
  to authenticated;

