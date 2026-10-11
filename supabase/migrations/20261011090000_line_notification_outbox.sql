-- LINE notification outbox.
--
-- Database triggers queue a message whenever something worth telling a user
-- happens, inside the same transaction as the change itself. A trusted server
-- dispatcher (app/api/line/dispatch) claims pending rows with the service role,
-- pushes them through the LINE Messaging API, and records the result.
--
-- Recipients:
-- - Admins: new maintenance reports, and a daily reminder for reports that
--   have waited for the court caretaker too long. Caretakers are never
--   messaged; admins phone them.
-- - Reporters: status changes on their own maintenance report.
-- - Team members: their team was called to check in.
create extension if not exists pg_net with schema extensions;

create table public.line_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'QUEUE_CALLED', 'MAINTENANCE_NEW', 'MAINTENANCE_STATUS', 'MAINTENANCE_WAITING_REMINDER'
  )),
  message text not null check (char_length(message) between 1 and 4000),
  link_path text check (link_path is null or link_path like '/%'),
  dedupe_key text not null unique,
  status text not null default 'PENDING' check (status in (
    'PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED', 'SKIPPED'
  )),
  attempts integer not null default 0,
  last_error text,
  expires_at timestamptz not null,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index line_notifications_pending_idx
  on public.line_notifications(created_at)
  where status in ('PENDING', 'SENDING');

alter table public.line_notifications enable row level security;
revoke all on public.line_notifications from public, anon, authenticated;

-- How long a report may stay WAITING_FOR_CARETAKER before admins are reminded.
alter table public.queue_settings
  add column maintenance_reminder_days integer not null default 2
    check (maintenance_reminder_days between 1 and 30);

create or replace function private.maintenance_category_th(p_category public.maintenance_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'SURFACE' then 'พื้นสนาม'
    when 'HOOP' then 'แป้นหรือห่วง'
    when 'LIGHTING' then 'ระบบไฟ'
    else 'อื่น ๆ'
  end;
$$;

create or replace function private.maintenance_status_th(p_status public.maintenance_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'NEW' then 'รอแอดมินรับเรื่อง'
    when 'IN_PROGRESS' then 'แอดมินรับเรื่องแล้ว'
    when 'WAITING_FOR_CARETAKER' then 'แจ้งผู้ดูแลสนามแล้ว รอเข้ามาซ่อม'
    when 'RESOLVED' then 'แก้ไขเรียบร้อยแล้ว'
    when 'REJECTED' then 'ไม่รับเรื่อง'
  end;
$$;

create or replace function private.enqueue_line_notification(
  p_recipient_user_id uuid,
  p_kind text,
  p_message text,
  p_link_path text,
  p_dedupe_key text,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.line_notifications(
    recipient_user_id, kind, message, link_path, dedupe_key, expires_at
  ) values (
    p_recipient_user_id, p_kind, left(p_message, 4000), p_link_path, p_dedupe_key, p_expires_at
  )
  on conflict (dedupe_key) do nothing;
$$;

-- New maintenance report: tell every admin.
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
      format(E'🛠 มีรายการแจ้งซ่อมใหม่\nสนาม %s · %s\n"%s"',
        coalesce(v_court_name, new.court_id),
        private.maintenance_category_th(new.category),
        left(new.details, 120)),
      '/admin/maintenance',
      'maintenance-new:' || new.id || ':' || v_admin.id,
      now() + interval '24 hours'
    );
  end loop;
  return new;
end;
$$;

create trigger maintenance_reports_notify_created
after insert on public.maintenance_reports
for each row execute function private.notify_maintenance_report_created();

-- Status change recorded in history: tell the reporter.
create or replace function private.notify_maintenance_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.maintenance_reports;
  v_court_name text;
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

  v_message := format(E'📋 อัปเดตรายการแจ้งซ่อมของคุณ\nสนาม %s · %s\nสถานะ: %s',
    coalesce(v_court_name, v_report.court_id),
    private.maintenance_category_th(v_report.category),
    private.maintenance_status_th(new.to_status));
  if new.admin_note is not null then
    v_message := v_message || E'\nหมายเหตุ: ' || left(new.admin_note, 200);
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

create trigger maintenance_status_history_notify
after insert on public.maintenance_status_history
for each row execute function private.notify_maintenance_status_changed();

-- Team called to check in: tell every current team member. The message is
-- useless after the check-in deadline, so it expires then.
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
      format(E'🏀 ถึงคิวทีม %s แล้ว!\nสนาม %s\nกรุณาไปเช็กอินที่สนามภายใน %s น.',
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

create trigger queue_entries_notify_called
after update of status on public.queue_entries
for each row
when (new.status = 'CALLED' and old.status is distinct from 'CALLED')
execute function private.notify_queue_team_called();

-- Daily reminder to admins for reports still waiting for the caretaker.
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
        format(E'⏰ งานซ่อมค้างนานแล้ว\nสนาม %s · %s\nรอผู้ดูแลสนามมา %s วัน ลองโทรตามผลอีกครั้ง',
          coalesce(v_report.court_name, v_report.court_id),
          private.maintenance_category_th(v_report.category),
          greatest(1, extract(day from now() - v_report.updated_at)::integer)),
        '/admin/maintenance',
        'maintenance-reminder:' || v_report.id || ':' || v_admin.id || ':' || v_today,
        now() + interval '12 hours'
      );
    end loop;
  end loop;
end;
$$;

-- Dispatcher API, callable only with the service role key on the server.
create or replace function public.claim_line_notifications(p_limit integer default 20)
returns table(id uuid, line_user_id text, message text, link_path text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.line_notifications notification
  set status = 'EXPIRED', locked_until = null
  where notification.status in ('PENDING', 'SENDING')
    and notification.expires_at <= now();

  -- Recipients who never signed in with LINE cannot be messaged.
  update public.line_notifications notification
  set status = 'SKIPPED', last_error = 'NO_LINE_IDENTITY', locked_until = null
  where notification.status = 'PENDING'
    and not exists (
      select 1 from auth.identities identity
      where identity.user_id = notification.recipient_user_id
        and identity.provider = 'custom:line'
    );

  return query
  with claimed as (
    select notification.id
    from public.line_notifications notification
    where notification.status = 'PENDING'
       or (notification.status = 'SENDING' and notification.locked_until < now())
    order by notification.created_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  )
  update public.line_notifications notification
  set status = 'SENDING',
      attempts = notification.attempts + 1,
      locked_until = now() + interval '2 minutes'
  from claimed
  where notification.id = claimed.id
  returning notification.id,
    (select identity.provider_id from auth.identities identity
     where identity.user_id = notification.recipient_user_id
       and identity.provider = 'custom:line'
     order by identity.updated_at desc nulls last
     limit 1),
    notification.message,
    notification.link_path,
    notification.attempts;
end;
$$;

-- p_outcome: SENT, RETRY (temporary failure), or FAILED (permanent).
create or replace function public.complete_line_notification(
  p_id uuid,
  p_outcome text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('SENT', 'RETRY', 'FAILED') then
    raise exception using errcode = '22023', message = 'INVALID_OUTCOME';
  end if;

  update public.line_notifications notification
  set status = case
        when p_outcome = 'SENT' then 'SENT'
        when p_outcome = 'RETRY' and notification.attempts < 3 then 'PENDING'
        else 'FAILED'
      end,
      sent_at = case when p_outcome = 'SENT' then now() else notification.sent_at end,
      last_error = case when p_outcome = 'SENT' then null else left(p_error, 500) end,
      locked_until = null
  where notification.id = p_id
    and notification.status = 'SENDING';
end;
$$;

revoke execute on function public.claim_line_notifications(integer) from public, anon, authenticated;
revoke execute on function public.complete_line_notification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_line_notifications(integer) to service_role;
grant execute on function public.complete_line_notification(uuid, text, text) to service_role;

revoke execute on function private.enqueue_line_notification(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function private.enqueue_maintenance_waiting_reminders() from public, anon, authenticated;

-- Wake the dispatcher every minute when there is work. Messages triggered by
-- the web app are also dispatched right after the request, so this mainly
-- covers queue calls made by scheduled jobs and retries.
--
-- Needs two Vault secrets, created once per environment:
--   select vault.create_secret('https://<app>/api/line/dispatch', 'meq_line_dispatch_url');
--   select vault.create_secret('<same value as LINE_DISPATCH_SECRET>', 'meq_line_dispatch_secret');
-- Without them this does nothing.
create or replace function private.request_line_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.line_notifications
    where status = 'PENDING'
       or (status = 'SENDING' and locked_until < now())
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'meq_line_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'meq_line_dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function private.request_line_dispatch() from public, anon, authenticated;

select cron.schedule('meq-line-dispatch', '* * * * *', 'select private.request_line_dispatch();');
-- 09:00 Asia/Bangkok.
select cron.schedule('meq-maintenance-waiting-reminders', '0 2 * * *', 'select private.enqueue_maintenance_waiting_reminders();');
