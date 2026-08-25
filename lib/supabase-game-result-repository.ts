import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourtId } from "./queue-types";

export type SupabaseGameResultData = {
  id: string;
  courtId: CourtId;
  targetScore: number;
  status: string;
  completedAt: string | null;
  teamA: { id: string; name: string; score: number | null };
  teamB: { id: string; name: string; score: number | null };
  winnerTeamId: string | null;
  loserTeamId: string | null;
  winnerQueueStatus: string | null;
  loserQueueStatus: string | null;
  loserDecisionDeadline: string | null;
  isWinnerCaptain: boolean;
  isLoserCaptain: boolean;
  playerScores: { teamId: string; userId: string; displayName: string; points: number }[];
};

export async function getSupabaseGameResult(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
): Promise<SupabaseGameResultData | null> {
  await supabase.rpc("expire_post_game_decisions", { p_court_id: null });
  const { data: gameData, error } = await supabase.from("games")
    .select("id,court_id,team_a_id,team_b_id,target_score,status,completed_at,winner_team_id,loser_team_id,final_team_a_score,final_team_b_score")
    .eq("id", gameId).maybeSingle();
  if (error) throw new Error(`GAME_RESULT_FAILED: ${error.message}`);
  if (!gameData) return null;
  const teamIds = [gameData.team_a_id, gameData.team_b_id];
  const [{ data: teamsData }, { data: rosterData }, { data: scoresData }, { data: entriesData }] = await Promise.all([
    supabase.from("teams").select("id,name,captain_user_id").in("id", teamIds),
    supabase.from("game_roster_snapshots").select("team_id,user_id,display_name").eq("game_id", gameId),
    supabase.from("player_scores").select("team_id,user_id,points").eq("game_id", gameId),
    supabase.from("queue_entries").select("team_id,status,decision_deadline,joined_at")
      .eq("court_id", gameData.court_id).in("team_id", teamIds).order("joined_at", { ascending: false }),
  ]);
  const teams = new Map((teamsData ?? []).map((team) => [team.id, team]));
  const latestEntry = new Map<string, { status: string; decision_deadline: string | null }>();
  for (const entry of entriesData ?? []) if (!latestEntry.has(entry.team_id)) latestEntry.set(entry.team_id, entry);
  const scoreByPlayer = new Map((scoresData ?? []).map((score) => [`${score.team_id}:${score.user_id}`, score.points]));
  const winner = gameData.winner_team_id ? teams.get(gameData.winner_team_id) : null;
  const loser = gameData.loser_team_id ? teams.get(gameData.loser_team_id) : null;
  const loserEntry = gameData.loser_team_id ? latestEntry.get(gameData.loser_team_id) : null;
  return {
    id: gameData.id,
    courtId: gameData.court_id as CourtId,
    targetScore: gameData.target_score,
    status: gameData.status,
    completedAt: gameData.completed_at,
    teamA: { id: gameData.team_a_id, name: teams.get(gameData.team_a_id)?.name ?? "ทีม A", score: gameData.final_team_a_score },
    teamB: { id: gameData.team_b_id, name: teams.get(gameData.team_b_id)?.name ?? "ทีม B", score: gameData.final_team_b_score },
    winnerTeamId: gameData.winner_team_id,
    loserTeamId: gameData.loser_team_id,
    winnerQueueStatus: gameData.winner_team_id ? latestEntry.get(gameData.winner_team_id)?.status ?? null : null,
    loserQueueStatus: loserEntry?.status ?? null,
    loserDecisionDeadline: loserEntry?.decision_deadline ?? null,
    isWinnerCaptain: winner?.captain_user_id === userId,
    isLoserCaptain: loser?.captain_user_id === userId,
    playerScores: (rosterData ?? []).map((member) => ({
      teamId: member.team_id,
      userId: member.user_id,
      displayName: member.display_name,
      points: scoreByPlayer.get(`${member.team_id}:${member.user_id}`) ?? 0,
    })),
  };
}
