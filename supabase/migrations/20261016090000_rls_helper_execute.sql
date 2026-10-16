-- RLS policies on player_game_history, player_scores, score_submissions,
-- maintenance_reports, and audit_logs call private.is_admin() and
-- private.is_active_team_member(). The foundation migration revoked EXECUTE on
-- these helpers from authenticated, so every direct read of those tables by a
-- signed-in user failed with "permission denied for function is_admin", and the
-- pages showed empty statistics and scores instead of an error.
--
-- Both helpers are SECURITY DEFINER, take no data from the caller beyond a team
-- id, and only answer whether the caller is an admin or an active member, so
-- signed-in users may execute them. The private schema is still not exposed by
-- the Data API.
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_team_member(uuid) to authenticated;
