# KPI-3: LINE notifications during the field evaluation, 17 October 2026

Source: `public.line_notifications` on the production project, rows created between
17:00 and 19:30 Bangkok time (10:00–12:30 UTC). The owner ran the read-only, aggregate
query below in the Supabase SQL Editor on 18 October 2026; no recipient was selected.

```sql
select kind, count(*) as total,
       count(*) filter (where status = 'SENT') as sent,
       count(*) filter (where sent_at - created_at <= interval '60 seconds') as within_60s,
       round(percentile_cont(0.5) within group (order by extract(epoch from sent_at - created_at))::numeric, 1) as median_s,
       round(max(extract(epoch from sent_at - created_at))::numeric, 1) as max_s,
       max(attempts) as max_attempts
from public.line_notifications
where created_at >= '2026-10-17 10:00+00' and created_at < '2026-10-17 12:30+00'
group by rollup(kind) order by kind;
```

| kind | total | sent | within_60s | median_s | max_s | max_attempts |
|---|---|---|---|---|---|---|
| MAINTENANCE_NEW | 1 | 1 | 1 | 0.7 | 0.7 | 1 |
| QUEUE_CALLED | 3 | 3 | 3 | 11.6 | 51.8 | 1 |
| QUEUE_NEXT | 3 | 3 | 3 | 8.4 | 11.4 | 1 |
| SCORE_REQUEST | 2 | 2 | 2 | 30.9 | 31.1 | 1 |
| TEAM_INVITATION | 6 | 6 | 6 | 0.8 | 1.0 | 1 |
| (all) | 15 | 15 | 15 | 1.0 | 51.8 | 1 |
