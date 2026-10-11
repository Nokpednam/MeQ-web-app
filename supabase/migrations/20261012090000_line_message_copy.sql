-- Plain-text LINE messages per role, without emoji, plus three new events:
-- next in queue, team invitation, and game result.
alter table public.line_notifications drop constraint line_notifications_kind_check;
alter table public.line_notifications add constraint line_notifications_kind_check check (kind in (
  'QUEUE_CALLED', 'QUEUE_NEXT', 'TEAM_INVITATION', 'GAME_RESULT',
  'MAINTENANCE_NEW', 'MAINTENANCE_STATUS', 'MAINTENANCE_WAITING_REMINDER'
));

-- Admins: new maintenance report.
create or replace function private.notify_maintenance_report_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court_name text;
  v_admin record;
begin
  select name into v_court_name from public.courts where id = new.court_id;

  for v_admin in select id from public.profiles where role = 'ADMIN' loop
    perform private.enqueue_line_notification(
      v_admin.id,
      'MAINTENANCE_NEW',
      format(E'มีรายการแจ้งซ่อมใหม่\nสนาม %s · %s\nรายละเอียด: %s\n\nตรวจสอบและรับเรื่องได้ที่หน้าจัดการแจ้งซ่อม',
        coalesce(v_court_name, new.court_id),
        private.maintenance_category_th(new.category),
        left(new.details, 200)),
      '/admin/maintenance',
      'maintenance-new:' || new.id || ':' || v_admin.id,
      now() + interval '24 hours'
    );
  end loop;
  return new;
end;
$$;

-- Reporter: status change on their report.
create or replace function private.notify_maintenance_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.maintenance_reports;
  v_court_name text;
  v_headline text;
  v_message text;
begin
  if new.from_status is null or new.from_status = new.to_status or new.to_status = 'NEW' then
    return new;
  end if;

  select * into v_report from public.maintenance_reports where id = new.report_id;
  if v_report.id is null then
    return new;
  end if;
  select name into v_court_name from public.courts where id = v_report.court_id;

  v_headline := case new.to_status
    when 'IN_PROGRESS' then 'แอดมินรับเรื่องแจ้งซ่อมของคุณแล้ว'
    when 'WAITING_FOR_CARETAKER' then 'แจ้งผู้ดูแลสนามแล้ว กำลังรอเข้ามาซ่อม'
    when 'RESOLVED' then 'รายการแจ้งซ่อมของคุณแก้ไขเรียบร้อยแล้ว ขอบคุณที่ช่วยแจ้ง'
    when 'REJECTED' then 'แอดมินไม่รับเรื่องแจ้งซ่อมรายการนี้'
  end;

  v_message := format(E'%s\nสนาม %s · %s',
    v_headline,
    coalesce(v_court_name, v_report.court_id),
    private.maintenance_category_th(v_report.category));
  if new.admin_note is not null then
    v_message := v_message || E'\nหมายเหตุจากแอดมิน: ' || left(new.admin_note, 200);
  end if;

  perform private.enqueue_line_notification(
    v_report.reporter_user_id,
    'MAINTENANCE_STATUS',
    v_message,
    '/maintenance',
    'maintenance-status:' || new.id,
    now() + interval '24 hours'
  );
  return new;
end;
$$;

-- Admins: reports still waiting for the caretaker.
create or replace function private.enqueue_maintenance_waiting_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_report record;
  v_admin record;
  v_today text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
begin
  select maintenance_reminder_days into v_days from public.queue_settings where singleton = true;
  v_days := coalesce(v_days, 2);

  for v_report in
    select report.id, report.court_id, report.category, report.updated_at, court.name as court_name
    from public.maintenance_reports report
    left join public.courts court on court.id = report.court_id
    where report.status = 'WAITING_FOR_CARETAKER'
      and report.updated_at < now() - make_interval(days => v_days)
  loop
    for v_admin in select id from public.profiles where role = 'ADMIN' loop
      perform private.enqueue_line_notification(
        v_admin.id,
        'MAINTENANCE_WAITING_REMINDER',
        format(E'งานซ่อมค้างรอผู้ดูแลสนามมา %s วันแล้ว\nสนาม %s · %s\nลองโทรติดตามผลกับผู้ดูแลสนามอีกครั้ง',
          greatest(1, extract(day from now() - v_report.updated_at)::integer),
          coalesce(v_report.court_name, v_report.court_id),
          private.maintenance_category_th(v_report.category)),
        '/admin/maintenance',
        'maintenance-reminder:' || v_report.id || ':' || v_admin.id || ':' || v_today,
        now() + interval '12 hours'
      );
    end loop;
  end loop;
end;
$$;

-- Team members: called to check in.
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
  v_member record;
begin
  select name into v_team_name from public.teams where id = new.team_id;
  select name into v_court_name from public.courts where id = new.court_id;

  for v_member in
    select user_id from public.team_memberships
    where team_id = new.team_id and left_at is null
  loop
    perform private.enqueue_line_notification(
      v_member.user_id,
      'QUEUE_CALLED',
      format(E'ถึงคิวทีม %s แล้ว\nสนาม %s\nกรุณาไปเช็กอินที่สนามภายใน %s น.\nถ้าไม่เช็กอินทันเวลา ระบบจะข้ามไปทีมถัดไป',
        coalesce(v_team_name, 'ของคุณ'),
        coalesce(v_court_name, new.court_id),
        to_char(v_deadline at time zone 'Asia/Bangkok', 'HH24:MI')),
      '/courts/' || new.court_id,
      'queue-called:' || new.id || ':' || v_member.user_id || ':'
        || extract(epoch from coalesce(new.called_at, now()))::bigint,
      v_deadline
    );
  end loop;
  return new;
end;
$$;

-- Team members: their team became first in the waiting line. Queue
-- reordering briefly clears positions, so the dedupe key keeps this to one
-- message per queue entry.
create or replace function private.notify_queue_team_next()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
  v_court_name text;
  v_member record;
begin
  select name into v_team_name from public.teams where id = new.team_id;
  select name into v_court_name from public.courts where id = new.court_id;

  for v_member in
    select user_id from public.team_memberships
    where team_id = new.team_id and left_at is null
  loop
    perform private.enqueue_line_notification(
      v_member.user_id,
      'QUEUE_NEXT',
      format(E'ทีม %s เป็นคิวถัดไปที่สนาม %s\nเตรียมตัวไปรอที่สนามได้เลย เมื่อถึงคิวจะมีข้อความแจ้งอีกครั้ง',
        coalesce(v_team_name, 'ของคุณ'),
        coalesce(v_court_name, new.court_id)),
      '/courts/' || new.court_id,
      'queue-next:' || new.id || ':' || v_member.user_id,
      now() + interval '30 minutes'
    );
  end loop;
  return new;
end;
$$;

create trigger queue_entries_notify_next
after insert or update of status, position on public.queue_entries
for each row
when (new.status = 'WAITING' and new.position = 1)
execute function private.notify_queue_team_next();

-- Invitee: invited to a team.
create or replace function private.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams;
  v_inviter text;
begin
  if new.status <> 'PENDING' then
    return new;
  end if;
  select * into v_team from public.teams where id = new.team_id;
  select display_name into v_inviter from public.profiles where id = new.invited_by_user_id;

  perform private.enqueue_line_notification(
    new.invited_user_id,
    'TEAM_INVITATION',
    format(E'%s เชิญคุณเข้าร่วมทีม %s (%s)\nเปิดหน้าทีมเพื่อตอบรับหรือปฏิเสธคำเชิญ',
      coalesce(v_inviter, 'หัวหน้าทีม'),
      coalesce(v_team.name, 'ใหม่'),
      case v_team.format when 'FIVE_X_FIVE' then '5x5' else '3x3' end),
    '/teams',
    'team-invitation:' || new.id,
    now() + interval '24 hours'
  );
  return new;
end;
$$;

create trigger team_invitations_notify
after insert on public.team_invitations
for each row execute function private.notify_team_invitation();

-- Players: game result once the game is completed.
create or replace function private.notify_game_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court_name text;
  v_team_a text;
  v_team_b text;
  v_player record;
begin
  select name into v_court_name from public.courts where id = new.court_id;
  select name into v_team_a from public.teams where id = new.team_a_id;
  select name into v_team_b from public.teams where id = new.team_b_id;

  for v_player in
    select roster.user_id, roster.team_id
    from public.game_roster_snapshots roster
    where roster.game_id = new.id
  loop
    perform private.enqueue_line_notification(
      v_player.user_id,
      'GAME_RESULT',
      format(E'ผลการแข่งขันสนาม %s\n%s %s - %s %s\nทีมของคุณ%s',
        coalesce(v_court_name, new.court_id),
        coalesce(v_team_a, 'ทีม A'), coalesce(new.final_team_a_score::text, '-'),
        coalesce(new.final_team_b_score::text, '-'), coalesce(v_team_b, 'ทีม B'),
        case when new.winner_team_id = v_player.team_id then 'ชนะ' else 'แพ้' end),
      '/games/' || new.id || '/result',
      'game-result:' || new.id || ':' || v_player.user_id,
      now() + interval '6 hours'
    );
  end loop;
  return new;
end;
$$;

create trigger games_notify_result
after update of status on public.games
for each row
when (new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED')
execute function private.notify_game_result();

revoke execute on function private.notify_queue_team_next() from public, anon, authenticated;
revoke execute on function private.notify_team_invitation() from public, anon, authenticated;
revoke execute on function private.notify_game_result() from public, anon, authenticated;
