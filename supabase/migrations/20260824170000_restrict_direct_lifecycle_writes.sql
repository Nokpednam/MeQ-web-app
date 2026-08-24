-- Keep all queue, game, team, and administrative lifecycle mutations behind
-- validated security-definer RPCs. RLS remains a second line of defense.
revoke insert, update, delete on table
  public.courts,
  public.daily_score_settings,
  public.teams,
  public.team_memberships,
  public.queue_entries,
  public.active_queue_players,
  public.location_verifications,
  public.games,
  public.game_roster_snapshots,
  public.score_submissions,
  public.player_scores,
  public.player_game_history,
  public.team_check_ins,
  public.court_events,
  public.court_event_courts,
  public.audit_logs
from anon, authenticated;

-- Profiles may only change user-facing fields. Role promotion remains
-- unavailable through the Data API.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- Reports are created directly with a restricted column grant, but all status
-- and administrative changes must use admin_update_maintenance_status().
revoke update, delete on public.maintenance_reports from anon, authenticated;

