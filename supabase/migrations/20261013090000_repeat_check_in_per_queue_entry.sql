-- A losing team that requeues, and a rested winner that returns, keep their
-- queue entry. Each new call opens another check-in on that entry, so the
-- entry may have many closed check-ins but only one open one at a time.
alter table public.team_check_ins drop constraint team_check_ins_queue_entry_id_key;

create unique index team_check_ins_one_open_per_queue_entry
on public.team_check_ins(queue_entry_id)
where status in ('ACTIVE', 'READY');
