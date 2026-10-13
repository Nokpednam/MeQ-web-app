import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const unfinishedGameStatuses = ["PLAYING", "END_REQUESTED", "AWAITING_SCORE", "VALIDATING_RESULT", "INVALID_SCORE"];

export type UserAlerts = {
  pendingInvitations: number;
  activeGame: {
    id: string;
    courtId: string;
    status: string;
    /** Captain or game delegate: may request the end and submit scores. */
    isLeader: boolean;
    myTeamSubmitted: boolean;
  } | null;
};

/** What the signed-in user should not miss: an unfinished game of their team and pending invitations. */
export async function getUserAlerts(supabase: SupabaseClient, userId: string): Promise<UserAlerts> {
  const [{ data: membership }, { count }] = await Promise.all([
    supabase.from("team_memberships").select("team_id").eq("user_id", userId).is("left_at", null).maybeSingle(),
    supabase.from("team_invitations").select("id", { count: "exact", head: true }).eq("invited_user_id", userId).eq("status", "PENDING"),
  ]);
  const pendingInvitations = count ?? 0;
  if (!membership) return { pendingInvitations, activeGame: null };

  const teamId: string = membership.team_id;
  const [{ data: game }, { data: team }] = await Promise.all([
    supabase.from("games").select("id,court_id,status")
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .in("status", unfinishedGameStatuses)
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("teams").select("captain_user_id,game_delegate_user_id").eq("id", teamId).maybeSingle(),
  ]);
  if (!game) return { pendingInvitations, activeGame: null };

  const { data: submission } = await supabase.from("score_submissions").select("status")
    .eq("game_id", game.id).eq("team_id", teamId).maybeSingle();
  return {
    pendingInvitations,
    activeGame: {
      id: game.id,
      courtId: game.court_id,
      status: game.status,
      isLeader: team?.captain_user_id === userId || team?.game_delegate_user_id === userId,
      myTeamSubmitted: submission?.status === "SUBMITTED",
    },
  };
}
