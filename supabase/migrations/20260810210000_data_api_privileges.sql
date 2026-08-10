-- RLS policies filter rows, while PostgreSQL grants permit the Data API role
-- to perform the operation at all. Lifecycle writes remain RPC-only.

grant usage on schema public to anon, authenticated;

grant select on table
  public.court_groups,
  public.courts,
  public.daily_score_settings,
  public.court_events,
  public.court_event_courts
to anon, authenticated;

grant select on table
  public.profiles,
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
  public.maintenance_reports,
  public.audit_logs,
  public.player_statistics
to authenticated;

-- A user can create their own report; RLS validates reporter_user_id.
grant insert (reporter_user_id, court_id, category, details, image_path)
  on public.maintenance_reports to authenticated;

-- Only ADMIN rows pass the update policy.
grant update on public.maintenance_reports to authenticated;

-- Keep role protected while allowing a user to maintain safe profile fields.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
