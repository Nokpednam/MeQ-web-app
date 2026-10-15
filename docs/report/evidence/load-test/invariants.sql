-- KPI-1 invariant queries, run after each load run. Every count must be 0.
with active as (
  select * from public.queue_entries
  where status in ('WAITING','CALLED','CHECKING_IN','READY_TO_PLAY','PLAYING','DECIDING_CONTINUE','HOLDING_COURT',
                   'DECIDING_REQUEUE','AWAITING_SCORE','RESTING','RETURNING_CHAMPION')
), positioned as (
  select * from public.queue_entries
  where status in ('WAITING','CALLED','CHECKING_IN','READY_TO_PLAY','RETURNING_CHAMPION')
)
select 'I1 team in more than one active queue' as invariant,
       (select count(*) from (select team_id from active group by team_id having count(*) > 1) x) as violations
union all
select 'I2 player in more than one active queue',
       (select count(*) from (
          select tm.user_id from active a join public.team_memberships tm on tm.team_id = a.team_id and tm.left_at is null
          group by tm.user_id having count(*) > 1) x)
union all
select 'I3 duplicate position on a court',
       (select count(*) from (select court_id, position from positioned where position is not null
          group by court_id, position having count(*) > 1) x)
union all
-- A called team's position is cleared by design; only waiting teams must have one.
select 'I4 waiting entry without a position',
       (select count(*) from public.queue_entries where status = 'WAITING' and position is null)
union all
select 'I9 more than two teams called on a court',
       (select count(*) from (select court_id from public.queue_entries
          where status in ('CALLED','CHECKING_IN','READY_TO_PLAY') group by court_id having count(*) > 2) x)
union all
select 'I5 waiting order differs from joining order',
       (select count(*) from positioned a join positioned b
          on a.court_id = b.court_id and a.status = 'WAITING' and b.status = 'WAITING'
         and a.position < b.position and a.joined_at > b.joined_at)
union all
select 'I6 active entry missing a player reservation',
       (select count(*) from active a join public.team_memberships tm on tm.team_id = a.team_id and tm.left_at is null
          where not exists (select 1 from public.active_queue_players p where p.user_id = tm.user_id and p.queue_entry_id = a.id))
union all
select 'I7 reservation for a closed or missing entry',
       (select count(*) from public.active_queue_players p
          where not exists (select 1 from active a where a.id = p.queue_entry_id))
union all
select 'I8 team on a court of the wrong format',
       (select count(*) from public.queue_entries q join public.teams t on t.id = q.team_id join public.courts c on c.id = q.court_id
          where (t.format = 'THREE_X_THREE') <> (c.required_members = 3));

select status, count(*) from public.queue_entries group by status order by 2 desc;
select count(*) filter (where action = 'QUEUE_JOINED') as joined, count(*) filter (where action = 'QUEUE_LEFT') as left_queue,
       count(*) filter (where action = 'QUEUE_CALLED') as called, count(*) filter (where action = 'QUEUE_ADVANCE_FAILED') as advance_failed
from public.audit_logs;
