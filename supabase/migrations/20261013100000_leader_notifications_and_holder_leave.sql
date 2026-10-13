-- Changes after the six-player field test:
-- 1. Team LINE messages (queue called, next in line, game without result) go
--    only to the captain and the game delegate. Game results are no longer
--    sent; players see them on the result page.
-- 2. The next-in-line message is keyed by joined_at, so a team that requeues
--    on the same queue entry is told again.
-- 3. A GPS verification lasts 30 minutes.
-- 4. A winner holding the court can leave the queue. A challenger already
--    called with nobody else waiting goes back to the head of the queue.

create or replace function private.team_leader_user_ids(p_team_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct leader.user_id
  from public.teams team
  cross join lateral (values (team.captain_user_id), (team.game_delegate_user_id)) as leader(user_id)
  join public.team_memberships membership
    on membership.team_id = team.id and membership.user_id = leader.user_id and membership.left_at is null
  where team.id = p_team_id;
$$;

create or replace function private.notify_queue_team_called()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
  v_court_name text;
  v_deadline timestamptz := coalesce(new.check_in_deadline, now() + interval '3 minutes');
  v_leader uuid;
begin
  select name into v_team_name from public.teams where id = new.team_id;
  select name into v_court_name from public.courts where id = new.court_id;

  for v_leader in select private.team_leader_user_ids(new.team_id) loop
    perform private.enqueue_line_notification(
      v_leader,
      'QUEUE_CALLED',
      format(E'ถึงคิวทีม %s แล้ว\nสนาม %s\nกรุณาไปเช็กอินที่สนามภายใน %s น.\nถ้าไม่เช็กอินทันเวลา ระบบจะข้ามไปทีมถัดไป',
        coalesce(v_team_name, 'ของคุณ'),
        coalesce(v_court_name, new.court_id),
        to_char(v_deadline at time zone 'Asia/Bangkok', 'HH24:MI')),
      '/courts/' || new.court_id,
      'queue-called:' || new.id || ':' || v_leader || ':'
        || extract(epoch from coalesce(new.called_at, now()))::bigint,
      v_deadline
    );
  end loop;
  return new;
end;
$$;

create or replace function private.notify_queue_team_next()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
  v_court_name text;
  v_leader uuid;
begin
  select name into v_team_name from public.teams where id = new.team_id;
  select name into v_court_name from public.courts where id = new.court_id;

  for v_leader in select private.team_leader_user_ids(new.team_id) loop
    perform private.enqueue_line_notification(
      v_leader,
      'QUEUE_NEXT',
      format(E'ทีม %s เป็นคิวถัดไปที่สนาม %s\nเตรียมตัวไปรอที่สนามได้เลย เมื่อถึงคิวจะมีข้อความแจ้งอีกครั้ง',
        coalesce(v_team_name, 'ของคุณ'),
        coalesce(v_court_name, new.court_id)),
      '/courts/' || new.court_id,
      'queue-next:' || new.id || ':' || v_leader || ':' || (extract(epoch from new.joined_at) * 1000)::bigint,
      now() + interval '30 minutes'
    );
  end loop;
  return new;
end;
$$;

create or replace function private.notify_game_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court_name text;
  v_reason text;
  v_leader uuid;
begin
  select name into v_court_name from public.courts where id = new.court_id;
  v_reason := case new.invalid_reason
    when 'SCORE_TIMEOUT' then 'ส่งคะแนนไม่ครบภายในเวลาที่กำหนด'
    when 'ADMIN_CANCELLED' then 'แอดมินยกเลิกเกม'
    else 'เกมถูกยกเลิก'
  end;

  for v_leader in
    select private.team_leader_user_ids(new.team_a_id)
    union
    select private.team_leader_user_ids(new.team_b_id)
  loop
    perform private.enqueue_line_notification(
      v_leader,
      'GAME_CANCELLED',
      format(E'เกมที่สนาม %s ไม่มีผล\nเหตุผล: %s\nทั้งสองทีมออกจากคิวแล้ว ลงคิวใหม่ได้ตามปกติ',
        coalesce(v_court_name, new.court_id), v_reason),
      '/courts/' || new.court_id,
      'game-cancelled:' || new.id || ':' || v_leader,
      now() + interval '2 hours'
    );
  end loop;
  return new;
end;
$$;

drop trigger games_notify_result on public.games;
drop function private.notify_game_result();

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
  v_expires_at timestamptz := now() + interval '30 minutes';
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

create or replace function public.leave_court_queue(p_queue_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries where id = p_queue_entry_id for update;
  if v_entry.id is null then raise exception using errcode='P0002', message='QUEUE_ENTRY_NOT_FOUND'; end if;
  if not private.is_team_captain(v_entry.team_id) then
    raise exception using errcode='42501', message='CAPTAIN_ONLY';
  end if;
  if v_entry.status not in ('WAITING','DECIDING_REQUEUE','HOLDING_COURT') then
    raise exception using errcode='23514', message='CANNOT_LEAVE_ACTIVE_STATE';
  end if;
  update public.queue_entries set status='LEFT_QUEUE', closed_at=now(), position=null
    where id=v_entry.id;
  delete from public.active_queue_players where queue_entry_id=v_entry.id;
  if v_entry.status = 'HOLDING_COURT' then
    update public.teams set consecutive_wins = 0, updated_at = now() where id = v_entry.team_id;
    -- Without the holder, a called challenger needs an opponent. If nobody
    -- else waits, send it back to the head of the queue so it is not
    -- dropped when its check-in deadline passes.
    if not exists (select 1 from public.queue_entries
      where court_id = v_entry.court_id and status in ('WAITING', 'RESTING')) then
      update public.team_check_ins set status = 'CLOSED', closed_at = now()
      where court_id = v_entry.court_id and status in ('ACTIVE', 'READY');
      update public.queue_entries
      set status = 'WAITING', joined_at = now() - interval '1 millisecond',
        called_at = null, check_in_deadline = null
      where court_id = v_entry.court_id and status in ('CALLED', 'CHECKING_IN', 'READY_TO_PLAY');
    end if;
  end if;
  perform private.reorder_court_waiting_queue(v_entry.court_id);
end;
$$;

revoke execute on function private.team_leader_user_ids(uuid) from public, anon, authenticated;
