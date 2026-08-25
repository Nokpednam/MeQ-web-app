import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourtId } from "./queue-types";

export type SupabaseGameData = {
  id: string;
  courtId: CourtId;
  targetScore: number;
  status: "PLAYING" | "END_REQUESTED" | "AWAITING_SCORE" | "VALIDATING_RESULT" | "INVALID_SCORE" | "COMPLETED" | "CANCELLED";
  startedAt: string;
  invalidReason: string | null;
  requestedByTeamId: string | null;
  requestedByUserId: string | null;
  currentUserId: string;
  captainTeamId: string | null;
  teamA: SupabaseGameTeam;
  teamB: SupabaseGameTeam;
  submittedTeamIds: string[];
};

export type SupabaseGameTeam = {
  id: string;
  name: string;
  captainUserId: string;
  members: { userId: string; displayName: string; points: number }[];
};

export async function getSupabaseGame(supabase: SupabaseClient, gameId: string, userId: string): Promise<SupabaseGameData | null> {
  const { data: game, error } = await supabase.from("games")
    .select("id,court_id,team_a_id,team_b_id,target_score,status,started_at,invalid_reason,end_requested_by_team_id,end_requested_by_user_id")
    .eq("id", gameId).maybeSingle();
  if (error) throw new Error(`GAME_LOAD_FAILED: ${error.message}`);
  if (!game) return null;
  const teamIds = [game.team_a_id, game.team_b_id];
  const [{ data: teams }, { data: roster }, { data: scores }, { data: submissions }] = await Promise.all([
    supabase.from("teams").select("id,name,captain_user_id").in("id", teamIds),
    supabase.from("game_roster_snapshots").select("team_id,user_id,display_name").eq("game_id", gameId),
    supabase.from("player_scores").select("team_id,user_id,points").eq("game_id", gameId),
    supabase.from("score_submissions").select("team_id,status").eq("game_id", gameId),
  ]);
  const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
  const scoreByPlayer = new Map((scores ?? []).map((score) => [`${score.team_id}:${score.user_id}`, score.points]));
  const mapTeam = (teamId: string): SupabaseGameTeam => {
    const team = teamById.get(teamId);
    return {
      id: teamId,
      name: team?.name ?? "ไม่พบชื่อทีม",
      captainUserId: team?.captain_user_id ?? "",
      members: (roster ?? []).filter((member) => member.team_id === teamId).map((member) => ({
        userId: member.user_id,
        displayName: member.display_name,
        points: scoreByPlayer.get(`${teamId}:${member.user_id}`) ?? 0,
      })),
    };
  };
  const teamA = mapTeam(game.team_a_id);
  const teamB = mapTeam(game.team_b_id);
  return {
    id: game.id,
    courtId: game.court_id as CourtId,
    targetScore: game.target_score,
    status: game.status,
    startedAt: game.started_at,
    invalidReason: game.invalid_reason,
    requestedByTeamId: game.end_requested_by_team_id,
    requestedByUserId: game.end_requested_by_user_id,
    currentUserId: userId,
    captainTeamId: teamA.captainUserId === userId ? teamA.id : teamB.captainUserId === userId ? teamB.id : null,
    teamA,
    teamB,
    submittedTeamIds: (submissions ?? []).filter((submission) => submission.status === "SUBMITTED").map((submission) => submission.team_id),
  };
}
