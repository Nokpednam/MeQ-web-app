-- MeQ database foundation.
-- Queue transitions and game finalization must be performed through RPCs in a
-- trusted transaction. Direct client writes to lifecycle tables are denied.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('USER', 'ADMIN');
create type public.team_format as enum ('THREE_X_THREE', 'FIVE_X_FIVE');
create type public.team_member_role as enum ('CAPTAIN', 'MEMBER');
create type public.queue_status as enum (
  'WAITING', 'CALLED', 'CHECKING_IN', 'READY_TO_PLAY', 'PLAYING',
  'DECIDING_CONTINUE', 'HOLDING_COURT', 'DECIDING_REQUEUE',
  'AWAITING_SCORE', 'RESTING', 'RETURNING_CHAMPION',
  'MISSED_QUEUE', 'CANCELLED', 'LEFT_QUEUE'
);
create type public.game_status as enum (
  'PLAYING', 'END_REQUESTED', 'AWAITING_SCORE', 'VALIDATING_RESULT',
  'COMPLETED', 'INVALID_SCORE', 'CANCELLED'
);
create type public.submission_status as enum ('DRAFT', 'SUBMITTED');
create type public.check_in_status as enum ('ACTIVE', 'READY', 'CLOSED', 'EXPIRED');
create type public.maintenance_status as enum ('NEW', 'IN_PROGRESS', 'RESOLVED');
create type public.maintenance_category as enum ('SURFACE', 'HOOP', 'LIGHTING', 'OTHER');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  role public.app_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.court_groups (
  id text primary key,
  name text not null,
  format public.team_format not null,
  allowed_target_scores integer[] not null,
  default_target_score integer not null,
  check (default_target_score = any(allowed_target_scores))
);

create table public.courts (
  id text primary key check (id in ('3x3-a', '3x3-b', '5x5')),
  court_group_id text not null references public.court_groups(id),
  name text not null unique,
  required_members integer not null check (required_members in (3, 5)),
  opens_at time not null default '05:00',
  closes_at time not null default '00:00',
  is_open boolean not null default true,
  image_path text,
  latitude double precision,
  longitude double precision,
  active_game_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_score_settings (
  court_group_id text not null references public.court_groups(id),
  business_date date not null,
  target_score integer not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (court_group_id, business_date)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 30),
  format public.team_format not null,
  captain_user_id uuid not null references public.profiles(id),
  consecutive_wins integer not null default 0 check (consecutive_wins between 0 and 2),
  dissolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  role public.team_member_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create unique index one_active_team_per_user
  on public.team_memberships(user_id) where left_at is null;
create unique index one_active_membership_per_team_user
  on public.team_memberships(team_id, user_id) where left_at is null;
create unique index one_active_captain_per_team
  on public.team_memberships(team_id) where left_at is null and role = 'CAPTAIN';

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  court_id text not null references public.courts(id),
  team_id uuid not null references public.teams(id),
  position bigint,
  status public.queue_status not null default 'WAITING',
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  check_in_deadline timestamptz,
  decision_deadline timestamptz,
  closed_at timestamptz,
  check (position is null or position > 0)
);
create unique index one_active_queue_per_team on public.queue_entries(team_id)
  where status in ('WAITING','CALLED','CHECKING_IN','READY_TO_PLAY','PLAYING',
    'DECIDING_CONTINUE','HOLDING_COURT','DECIDING_REQUEUE','AWAITING_SCORE',
    'RESTING','RETURNING_CHAMPION');
create unique index one_waiting_position_per_court on public.queue_entries(court_id, position)
  where status in ('WAITING','CALLED','CHECKING_IN','READY_TO_PLAY','RETURNING_CHAMPION');
create index queue_order on public.queue_entries(court_id, joined_at, position);

-- Maintained only by trusted queue RPCs. Its unique PK is the database-level
-- guarantee that a player cannot be active on two courts.
create table public.active_queue_players (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  queue_entry_id uuid not null references public.queue_entries(id) on delete cascade,
  court_id text not null references public.courts(id),
  team_id uuid not null references public.teams(id),
  created_at timestamptz not null default now()
);

create table public.location_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_id text not null references public.courts(id),
  distance_metres numeric(8,2) not null check (distance_metres >= 0),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  provider text not null check (provider in ('EDGE_GEOLOCATION', 'DEVELOPMENT')),
  check (expires_at > verified_at)
);
create index current_location_verification
  on public.location_verifications(user_id, court_id, expires_at desc);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  court_id text not null references public.courts(id),
  team_a_id uuid not null references public.teams(id),
  team_b_id uuid not null references public.teams(id),
  target_score integer not null check (target_score > 0),
  status public.game_status not null default 'PLAYING',
  started_at timestamptz not null default now(),
  end_requested_by_team_id uuid references public.teams(id),
  end_requested_by_user_id uuid references public.profiles(id),
  end_requested_at timestamptz,
  winner_team_id uuid references public.teams(id),
  loser_team_id uuid references public.teams(id),
  final_team_a_score integer check (final_team_a_score >= 0),
  final_team_b_score integer check (final_team_b_score >= 0),
  invalid_reason text,
  completed_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);
create unique index one_active_game_per_court on public.games(court_id)
  where status in ('PLAYING','END_REQUESTED','AWAITING_SCORE','VALIDATING_RESULT','INVALID_SCORE');
alter table public.courts add constraint courts_active_game_fk
  foreign key (active_game_id) references public.games(id) deferrable initially deferred;

create table public.game_roster_snapshots (
  game_id uuid not null references public.games(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  user_id uuid not null references public.profiles(id),
  display_name text not null,
  is_captain boolean not null default false,
  primary key (game_id, team_id, user_id)
);

create table public.score_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  submitted_by_user_id uuid not null references public.profiles(id),
  status public.submission_status not null default 'DRAFT',
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (game_id, team_id)
);

create table public.player_scores (
  game_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  points integer not null check (points >= 0),
  primary key (game_id, team_id, user_id),
  foreign key (game_id, team_id, user_id)
    references public.game_roster_snapshots(game_id, team_id, user_id) on delete cascade
);

create table public.player_game_history (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  format public.team_format not null,
  court_id text not null references public.courts(id),
  points integer not null check (points >= 0),
  won boolean not null,
  completed_at timestamptz not null,
  primary key (game_id, user_id)
);

create table public.team_check_ins (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null unique references public.queue_entries(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  court_id text not null references public.courts(id),
  status public.check_in_status not null default 'ACTIVE',
  captain_confirmed_by uuid references public.profiles(id),
  captain_confirmed_at timestamptz,
  deadline timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.court_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  cancelled_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table public.court_event_courts (
  event_id uuid not null references public.court_events(id) on delete cascade,
  court_id text not null references public.courts(id),
  primary key (event_id, court_id)
);

create table public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id),
  court_id text not null references public.courts(id),
  category public.maintenance_category not null,
  details text not null check (char_length(trim(details)) between 5 and 1000),
  image_path text,
  status public.maintenance_status not null default 'NEW',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'ADMIN'
  );
$$;

create or replace function private.is_active_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_memberships
    where team_id = p_team_id and user_id = (select auth.uid()) and left_at is null
  );
$$;

create or replace function private.is_team_captain(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and captain_user_id = (select auth.uid()) and dissolved_at is null
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'ผู้ใช้งาน'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function private.validate_team_membership()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_format public.team_format;
  v_max integer;
  v_count integer;
begin
  if new.left_at is not null then return new; end if;
  select format into v_format from public.teams where id = new.team_id and dissolved_at is null;
  if v_format is null then raise exception using errcode='23514', message='TEAM_NOT_FOUND'; end if;
  v_max := case when v_format = 'THREE_X_THREE' then 3 else 5 end;
  select count(*) into v_count from public.team_memberships
    where team_id = new.team_id and left_at is null and id <> new.id;
  if v_count >= v_max then raise exception using errcode='23514', message='TEAM_FULL'; end if;
  return new;
end;
$$;
create trigger validate_team_membership_before_write
  before insert or update of team_id, left_at on public.team_memberships
  for each row execute function private.validate_team_membership();

-- A player can enter only through a server-verified queue transaction.
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
        and lv.distance_metres <= 50 and lv.expires_at > now()
    )) then
    raise exception using errcode='23514', message='OUT_OF_RANGE';
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

create or replace function public.leave_court_queue(p_queue_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries where id = p_queue_entry_id for update;
  if v_entry.id is null then raise exception using errcode='P0002', message='QUEUE_ENTRY_NOT_FOUND'; end if;
  if not private.is_team_captain(v_entry.team_id) then
    raise exception using errcode='42501', message='CAPTAIN_ONLY';
  end if;
  if v_entry.status not in ('WAITING','DECIDING_REQUEUE') then
    raise exception using errcode='23514', message='CANNOT_LEAVE_ACTIVE_STATE';
  end if;
  update public.queue_entries set status='LEFT_QUEUE', closed_at=now(), position=null
    where id=v_entry.id;
  delete from public.active_queue_players where queue_entry_id=v_entry.id;
  with ordered as (
    select id, row_number() over(order by joined_at, id)::bigint as new_position
    from public.queue_entries where court_id=v_entry.court_id
      and status in ('WAITING','CALLED','CHECKING_IN','READY_TO_PLAY','RETURNING_CHAMPION')
  ) update public.queue_entries q set position=ordered.new_position
    from ordered where q.id=ordered.id;
end;
$$;

create or replace function private.finalize_game_result(p_game_id uuid)
returns public.games language plpgsql security definer set search_path = '' as $$
declare
  v_game public.games;
  v_a integer;
  v_b integer;
  v_winner uuid;
  v_loser uuid;
  v_winner_streak integer;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002', message='GAME_NOT_FOUND'; end if;
  if v_game.status='COMPLETED' then return v_game; end if;
  if (select count(*) from public.score_submissions where game_id=p_game_id and status='SUBMITTED') <> 2 then
    raise exception using errcode='23514', message='WAITING_FOR_OTHER_TEAM';
  end if;
  if exists (select 1 from public.game_roster_snapshots gr
    where gr.game_id=p_game_id and not exists (select 1 from public.player_scores ps
      where ps.game_id=gr.game_id and ps.team_id=gr.team_id and ps.user_id=gr.user_id)) then
    raise exception using errcode='23514', message='INCOMPLETE_PLAYERS';
  end if;
  select coalesce(sum(points),0) into v_a from public.player_scores
    where game_id=p_game_id and team_id=v_game.team_a_id;
  select coalesce(sum(points),0) into v_b from public.player_scores
    where game_id=p_game_id and team_id=v_game.team_b_id;
  if v_a=v_b then
    update public.games set status='INVALID_SCORE', invalid_reason='TIED_SCORE' where id=p_game_id returning * into v_game;
    return v_game;
  end if;
  if v_a < v_game.target_score and v_b < v_game.target_score then
    update public.games set status='INVALID_SCORE', invalid_reason='NO_TEAM_REACHED_TARGET' where id=p_game_id returning * into v_game;
    return v_game;
  end if;
  if v_a >= v_game.target_score and v_b >= v_game.target_score then
    update public.games set status='INVALID_SCORE', invalid_reason='BOTH_TEAMS_REACHED_TARGET' where id=p_game_id returning * into v_game;
    return v_game;
  end if;
  v_winner := case when v_a > v_b then v_game.team_a_id else v_game.team_b_id end;
  v_loser := case when v_a > v_b then v_game.team_b_id else v_game.team_a_id end;
  select consecutive_wins + 1 into v_winner_streak from public.teams where id=v_winner for update;
  update public.games set status='COMPLETED', winner_team_id=v_winner, loser_team_id=v_loser,
    final_team_a_score=v_a, final_team_b_score=v_b, invalid_reason=null,
    completed_at=now(), finalized_at=now() where id=p_game_id returning * into v_game;
  update public.courts set active_game_id=null, updated_at=now()
    where id=v_game.court_id and active_game_id=p_game_id;
  insert into public.player_game_history(game_id,user_id,team_id,format,court_id,points,won,completed_at)
    select p_game_id, gr.user_id, gr.team_id, t.format, v_game.court_id, ps.points,
      gr.team_id=v_winner, v_game.completed_at
    from public.game_roster_snapshots gr
    join public.player_scores ps on ps.game_id=gr.game_id and ps.team_id=gr.team_id and ps.user_id=gr.user_id
    join public.teams t on t.id=gr.team_id where gr.game_id=p_game_id
    on conflict (game_id,user_id) do nothing;
  update public.queue_entries set status='DECIDING_REQUEUE', decision_deadline=now()+interval '3 minutes', position=null
    where court_id=v_game.court_id and team_id=v_loser and status in ('PLAYING','AWAITING_SCORE');
  update public.queue_entries set status=case when v_winner_streak>=2 then 'RESTING'::public.queue_status
      else 'DECIDING_CONTINUE'::public.queue_status end, position=null
    where court_id=v_game.court_id and team_id=v_winner and status in ('PLAYING','AWAITING_SCORE');
  update public.teams set consecutive_wins=case when id=v_winner then least(v_winner_streak,2) else 0 end,
    updated_at=now() where id in (v_winner,v_loser);
  update public.team_check_ins set status='CLOSED', closed_at=now()
    where court_id=v_game.court_id and team_id in (v_winner,v_loser) and status in ('ACTIVE','READY');
  insert into public.audit_logs(action,entity_type,entity_id,payload)
    values ('GAME_FINALIZED','game',p_game_id::text,jsonb_build_object('winnerTeamId',v_winner,'loserTeamId',v_loser));
  return v_game;
end;
$$;

create or replace function public.submit_team_scores(p_game_id uuid, p_scores jsonb)
returns public.games language plpgsql security definer set search_path = '' as $$
declare
  v_game public.games;
  v_team_id uuid;
  v_expected integer;
  v_received integer;
  v_result public.games;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception using errcode='P0002', message='GAME_NOT_FOUND'; end if;
  if v_game.status='COMPLETED' then return v_game; end if;
  if private.is_team_captain(v_game.team_a_id) then v_team_id:=v_game.team_a_id;
  elsif private.is_team_captain(v_game.team_b_id) then v_team_id:=v_game.team_b_id;
  else raise exception using errcode='42501', message='CAPTAIN_ONLY'; end if;
  if jsonb_typeof(p_scores) <> 'object' then raise exception using errcode='22023', message='INVALID_SCORE_VALUE'; end if;
  select count(*) into v_expected from public.game_roster_snapshots where game_id=p_game_id and team_id=v_team_id;
  select count(*) into v_received from jsonb_each_text(p_scores) s
    join public.game_roster_snapshots gr on gr.user_id::text=s.key
      and gr.game_id=p_game_id and gr.team_id=v_team_id
    where s.value ~ '^[0-9]+$';
  if v_expected=0 or v_received<>v_expected or (select count(*) from jsonb_object_keys(p_scores))<>v_expected then
    raise exception using errcode='23514', message='INCOMPLETE_PLAYERS';
  end if;
  insert into public.player_scores(game_id,team_id,user_id,points)
    select p_game_id,v_team_id,s.key::uuid,s.value::integer from jsonb_each_text(p_scores) s
    on conflict (game_id,team_id,user_id) do update set points=excluded.points;
  insert into public.score_submissions(game_id,team_id,submitted_by_user_id,status,submitted_at)
    values(p_game_id,v_team_id,auth.uid(),'SUBMITTED',now())
    on conflict(game_id,team_id) do update set submitted_by_user_id=excluded.submitted_by_user_id,
      status='SUBMITTED',submitted_at=now(),updated_at=now();
  update public.games set status=case when (select count(*) from public.score_submissions
      where game_id=p_game_id and status='SUBMITTED')=2 then 'VALIDATING_RESULT'::public.game_status
      else 'AWAITING_SCORE'::public.game_status end where id=p_game_id;
  if (select count(*) from public.score_submissions where game_id=p_game_id and status='SUBMITTED')=2 then
    select * into v_result from private.finalize_game_result(p_game_id);
  else select * into v_result from public.games where id=p_game_id;
  end if;
  return v_result;
end;
$$;

create view public.player_statistics with (security_invoker=true) as
select user_id, format, count(*)::integer as games_played,
  count(*) filter (where won)::integer as wins,
  count(*) filter (where not won)::integer as losses,
  coalesce(sum(points),0)::integer as total_points,
  round(avg(points)::numeric,2) as average_points,
  max(points)::integer as highest_score_in_game,
  round((100.0*count(*) filter (where won)/nullif(count(*),0))::numeric,2) as win_rate
from public.player_game_history group by user_id,format;

alter table public.profiles enable row level security;
alter table public.court_groups enable row level security;
alter table public.courts enable row level security;
alter table public.daily_score_settings enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.queue_entries enable row level security;
alter table public.active_queue_players enable row level security;
alter table public.location_verifications enable row level security;
alter table public.games enable row level security;
alter table public.game_roster_snapshots enable row level security;
alter table public.score_submissions enable row level security;
alter table public.player_scores enable row level security;
alter table public.player_game_history enable row level security;
alter table public.team_check_ins enable row level security;
alter table public.court_events enable row level security;
alter table public.court_event_courts enable row level security;
alter table public.maintenance_reports enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy public_court_groups_read on public.court_groups for select using (true);
create policy public_courts_read on public.courts for select using (true);
create policy public_scores_read on public.daily_score_settings for select using (true);
create policy teams_read on public.teams for select to authenticated using (true);
create policy memberships_read on public.team_memberships for select to authenticated using (true);
create policy queues_read on public.queue_entries for select to authenticated using (true);
create policy active_players_read on public.active_queue_players for select to authenticated using (true);
create policy own_location_read on public.location_verifications for select to authenticated
  using (user_id=(select auth.uid()));
create policy games_read on public.games for select to authenticated using (true);
create policy rosters_read on public.game_roster_snapshots for select to authenticated using (true);
create policy submissions_read_participant on public.score_submissions for select to authenticated
  using (private.is_active_team_member(team_id) or private.is_admin());
create policy player_scores_completed_or_own on public.player_scores for select to authenticated
  using (exists(select 1 from public.games g where g.id=game_id and g.status='COMPLETED')
    or private.is_active_team_member(team_id) or private.is_admin());
create policy own_history_read on public.player_game_history for select to authenticated
  using (user_id=(select auth.uid()) or private.is_admin());
create policy checkins_read on public.team_check_ins for select to authenticated using (true);
create policy events_read on public.court_events for select using (true);
create policy event_courts_read on public.court_event_courts for select using (true);
create policy maintenance_insert on public.maintenance_reports for insert to authenticated
  with check (reporter_user_id=(select auth.uid()));
create policy maintenance_read on public.maintenance_reports for select to authenticated
  using (reporter_user_id=(select auth.uid()) or private.is_admin());
create policy maintenance_admin_update on public.maintenance_reports for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (private.is_admin());

-- Prevent a user from promoting themself by updating the profile row.
revoke update on public.profiles from authenticated;
grant update(display_name, avatar_url) on public.profiles to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function private.is_admin() from public, anon, authenticated;
revoke execute on function private.is_active_team_member(uuid) from public, anon, authenticated;
revoke execute on function private.is_team_captain(uuid) from public, anon, authenticated;
revoke execute on function private.validate_team_membership() from public, anon, authenticated;
revoke execute on function private.finalize_game_result(uuid) from public, anon, authenticated;
revoke execute on function public.join_court_queue(text) from public, anon;
revoke execute on function public.leave_court_queue(uuid) from public, anon;
revoke execute on function public.submit_team_scores(uuid,jsonb) from public, anon;
grant execute on function public.join_court_queue(text) to authenticated;
grant execute on function public.leave_court_queue(uuid) to authenticated;
grant execute on function public.submit_team_scores(uuid,jsonb) to authenticated;

