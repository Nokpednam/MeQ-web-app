begin;

select plan(38);

select ok(
  not has_table_privilege('authenticated', 'public.' || lifecycle_table, 'INSERT')
  and not has_table_privilege('authenticated', 'public.' || lifecycle_table, 'UPDATE')
  and not has_table_privilege('authenticated', 'public.' || lifecycle_table, 'DELETE'),
  'authenticated cannot directly mutate ' || lifecycle_table
)
from (values
  ('courts'), ('daily_score_settings'), ('teams'), ('team_memberships'), ('team_invitations'),
  ('queue_entries'), ('active_queue_players'), ('location_verifications'),
  ('games'), ('game_roster_snapshots'), ('score_submissions'),
  ('player_scores'), ('player_game_history'), ('team_check_ins'),
  ('court_events'), ('court_event_courts'), ('queue_settings'), ('audit_logs')
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
  not has_table_privilege('authenticated', 'public.maintenance_reports', 'INSERT')
  and has_function_privilege(
    'authenticated',
    'public.create_maintenance_report(text, public.maintenance_category, text, text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_maintenance_report(text, public.maintenance_category, text, text)',
    'EXECUTE'
  ),
  'maintenance reports are created only through the authenticated workflow RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_update_maintenance_status(uuid, public.maintenance_status, text)',
    'EXECUTE'
  ),
  'validated maintenance admin RPC remains available'
);

select ok(
  has_function_privilege('authenticated','public.decide_winner_continuation(uuid, boolean)','EXECUTE')
  and not has_function_privilege('anon','public.decide_winner_continuation(uuid, boolean)','EXECUTE'),
  'winner continuation RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.decide_loser_requeue(uuid, boolean)','EXECUTE')
  and not has_function_privilege('anon','public.decide_loser_requeue(uuid, boolean)','EXECUTE'),
  'loser requeue RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.expire_post_game_decisions(text)','EXECUTE')
  and not has_function_privilege('anon','public.expire_post_game_decisions(text)','EXECUTE'),
  'post-game timeout RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.request_game_end(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.request_game_end(uuid)','EXECUTE'),
  'game end request RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.cancel_game_end_request(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.cancel_game_end_request(uuid)','EXECUTE'),
  'game end cancellation RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.reject_game_end_request(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.reject_game_end_request(uuid)','EXECUTE'),
  'game end rejection RPC is authenticated only'
);
select ok(
  not has_function_privilege('authenticated','private.expire_post_game_decisions_internal(text)','EXECUTE')
  and not has_function_privilege('anon','private.expire_post_game_decisions_internal(text)','EXECUTE'),
  'internal post-game expiry is not callable by clients'
);
select ok(
  not has_function_privilege('authenticated','private.expire_all_queue_timeouts()','EXECUTE')
  and not has_function_privilege('anon','private.expire_all_queue_timeouts()','EXECUTE'),
  'scheduled queue cleanup is not callable by clients'
);
select ok(
  has_function_privilege('authenticated','public.propose_game_target_score(uuid,integer)','EXECUTE')
  and not has_function_privilege('anon','public.propose_game_target_score(uuid,integer)','EXECUTE'),
  'target score proposal RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.confirm_game_target_score(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.confirm_game_target_score(uuid)','EXECUTE'),
  'target score confirmation RPC is authenticated only'
);
select ok(
  has_function_privilege('authenticated','public.admin_set_check_in_duration(integer)','EXECUTE')
  and not has_function_privilege('anon','public.admin_set_check_in_duration(integer)','EXECUTE'),
  'check-in duration admin RPC is authenticated only'
);
select ok(
  not has_function_privilege('authenticated','public.add_team_member(uuid,uuid)','EXECUTE'),
  'authenticated cannot bypass invitations with direct member addition'
);
select ok(
  has_function_privilege('authenticated','public.invite_team_member(uuid,uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.accept_team_invitation(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.decline_team_invitation(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.cancel_team_invitation(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.invite_team_member(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.accept_team_invitation(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.decline_team_invitation(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.cancel_team_invitation(uuid)','EXECUTE'),
  'team invitation RPCs are authenticated only'
);

select ok(
  not has_table_privilege('authenticated', 'public.maintenance_status_history', 'SELECT')
  and not has_table_privilege('authenticated', 'public.maintenance_status_history', 'INSERT')
  and not has_function_privilege('anon', 'public.admin_list_maintenance_history(uuid[])', 'EXECUTE'),
  'maintenance status history is read only through the admin RPC'
);

select * from finish();

rollback;
