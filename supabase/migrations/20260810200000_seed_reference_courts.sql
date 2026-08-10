-- Reference data required in every environment.
-- This belongs in a migration (not only seed.sql) so hosted projects receive it
-- through `supabase db push`. Inserts are idempotent for safe re-application.

insert into public.court_groups (
  id,
  name,
  format,
  allowed_target_scores,
  default_target_score
)
values
  ('3x3', 'สนาม 3x3', 'THREE_X_THREE', '{7,9,11}', 7),
  ('5x5', 'สนาม 5x5', 'FIVE_X_FIVE', '{11,15,21}', 15)
on conflict (id) do update
set
  name = excluded.name,
  format = excluded.format,
  allowed_target_scores = excluded.allowed_target_scores,
  default_target_score = excluded.default_target_score;

insert into public.courts (
  id,
  court_group_id,
  name,
  required_members,
  opens_at,
  closes_at
)
values
  ('3x3-a', '3x3', '3x3 A', 3, '05:00', '00:00'),
  ('3x3-b', '3x3', '3x3 B', 3, '05:00', '00:00'),
  ('5x5', '5x5', '5x5', 5, '05:00', '00:00')
on conflict (id) do update
set
  court_group_id = excluded.court_group_id,
  name = excluded.name,
  required_members = excluded.required_members,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at;

