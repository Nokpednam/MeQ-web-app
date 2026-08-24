begin;

select plan(22);

select ok(
  not has_table_privilege('authenticated', 'public.' || lifecycle_table, 'INSERT')
  and not has_table_privilege('authenticated', 'public.' || lifecycle_table, 'UPDATE')
  and not has_table_privilege('authenticated', 'public.' || lifecycle_table, 'DELETE'),
  'authenticated cannot directly mutate ' || lifecycle_table
)
from (values
  ('courts'), ('daily_score_settings'), ('teams'), ('team_memberships'),
  ('queue_entries'), ('active_queue_players'), ('location_verifications'),
  ('games'), ('game_roster_snapshots'), ('score_submissions'),
  ('player_scores'), ('player_game_history'), ('team_check_ins'),
  ('court_events'), ('court_event_courts'), ('audit_logs')
) as lifecycle(lifecycle_table);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated cannot promote profiles.role'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
  and has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE'),
  'authenticated retains safe profile updates'
);
select ok(
  not has_table_privilege('authenticated', 'public.maintenance_reports', 'UPDATE'),
  'maintenance reports reject direct updates'
);
select ok(
  not has_table_privilege('authenticated', 'public.maintenance_reports', 'DELETE'),
  'maintenance reports reject direct deletes'
);
select ok(
  has_column_privilege('authenticated', 'public.maintenance_reports', 'reporter_user_id', 'INSERT'),
  'authenticated can still create maintenance reports'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_update_maintenance_status(uuid, public.maintenance_status, text)',
    'EXECUTE'
  ),
  'validated maintenance admin RPC remains available'
);

select * from finish();

rollback;
