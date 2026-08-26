import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedTeamPageData, type TeamPageData } from "./supabase-team-repository";
import type { Court, CourtId, QueueEntry, QueueTeamSnapshot } from "./queue-types";

const activeStatuses = ["WAITING", "CALLED", "CHECKING_IN", "READY_TO_PLAY", "PLAYING", "DECIDING_CONTINUE", "HOLDING_COURT", "DECIDING_REQUEUE", "AWAITING_SCORE", "RESTING", "RETURNING_CHAMPION"];

type CourtRow = { id: CourtId; name: Court["name"]; court_group_id: string; required_members: 3 | 5; opens_at: string; closes_at: string; is_open: boolean; image_path: string | null };
type GroupRow = { id: string; format: Court["type"]; allowed_target_scores: number[]; default_target_score: number };
type ScoreRow = { court_group_id: string; target_score: number; business_date: string };
type EntryRow = { id: string; court_id: CourtId; team_id: string; position: number | null; status: QueueEntry["status"]; joined_at: string; called_at: string | null; check_in_deadline: string | null };
type TeamRow = { id: string; name: string; format: Court["type"]; captain_user_id: string };
type CheckInRow = { id:string; queue_entry_id:string; team_id:string; court_id:CourtId; status:"ACTIVE"|"READY"; captain_confirmed_by:string|null; captain_confirmed_at:string|null; deadline:string; created_at:string };
type TargetProposalRow = { id:string;court_id:CourtId;proposer_check_in_id:string;opponent_check_in_id:string;proposed_by_team_id:string;target_score:number;status:"PENDING"|"CONFIRMED" };

export type SupabaseCheckIn = CheckInRow;
export type TeamLocationStatus = {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  status: "VERIFIED" | "MISSING" | "EXPIRED";
  expiresAt: string | null;
};
export type SupabaseQueueData = { teamData: TeamPageData; courts: Court[]; entries: QueueEntry[]; teams: QueueTeamSnapshot[]; checkIns:SupabaseCheckIn[]; targetProposals:TargetProposalRow[];isAdmin:boolean };

function openingTime(value: string) { return value.slice(0, 5) as "05:00"; }
function closingTime(value: string) { return value.slice(0, 5) as "00:00"; }

export async function getSupabaseQueueData(supabase: SupabaseClient, userId: string): Promise<SupabaseQueueData> {
  const [teamData, courtsResult, groupsResult, scoresResult, entriesResult, teamsResult,checkInsResult,proposalsResult] = await Promise.all([
    getCachedTeamPageData(supabase, userId),
    supabase.from("courts").select("id,name,court_group_id,required_members,opens_at,closes_at,is_open,image_path").order("id"),
    supabase.from("court_groups").select("id,format,allowed_target_scores,default_target_score"),
    supabase.from("daily_score_settings").select("court_group_id,target_score,business_date").order("business_date", { ascending: false }),
    supabase.from("queue_entries").select("id,court_id,team_id,position,status,joined_at,called_at,check_in_deadline").in("status", activeStatuses),
    supabase.from("teams").select("id,name,format,captain_user_id").is("dissolved_at", null),
    supabase.from("team_check_ins").select("id,queue_entry_id,team_id,court_id,status,captain_confirmed_by,captain_confirmed_at,deadline,created_at").in("status",["ACTIVE","READY"]),
    supabase.from("game_target_score_proposals").select("id,court_id,proposer_check_in_id,opponent_check_in_id,proposed_by_team_id,target_score,status").in("status",["PENDING","CONFIRMED"]),
  ]);
  const groups = (groupsResult.data ?? []) as GroupRow[]; const scores = (scoresResult.data ?? []) as ScoreRow[];
  const groupById = new Map(groups.map((group) => [group.id, group])); const latestScore = new Map<string, number>();
  for (const score of scores) if (!latestScore.has(score.court_group_id)) latestScore.set(score.court_group_id, score.target_score);
  const courts = ((courtsResult.data ?? []) as CourtRow[]).map((row) => { const group = groupById.get(row.court_group_id); if (!group) throw new Error("COURT_GROUP_NOT_FOUND"); return { id: row.id, name: row.name, type: group.format, requiredMembers: row.required_members, image: row.image_path ?? `/courts/${row.id}.svg`, isOpen: row.is_open, opensAt: openingTime(row.opens_at), closesAt: closingTime(row.closes_at), targetScore: latestScore.get(group.id) ?? group.default_target_score, allowedTargetScores: group.allowed_target_scores }; });
  const entries = ((entriesResult.data ?? []) as EntryRow[]).map((row) => ({ id: row.id, courtId: row.court_id, teamId: row.team_id, position: row.position ?? 0, status: row.status, joinedAt: row.joined_at, ...(row.called_at ? { calledAt: row.called_at } : {}), ...(row.check_in_deadline ? { checkInDeadline: row.check_in_deadline } : {}) }));
  const teams = ((teamsResult.data ?? []) as TeamRow[]).map((team) => { const members = teamData.users.filter((user) => user.currentTeamId === team.id).map((user) => ({ id: user.id, displayName: user.displayName, initials: user.initials })); return { id: team.id, name: team.name, type: team.format, captainUserId: team.captain_user_id, memberCount: members.length, members }; });
  return { teamData, courts, entries, teams,checkIns:(checkInsResult.data??[]) as CheckInRow[],targetProposals:(proposalsResult.data??[]) as TargetProposalRow[],isAdmin:teamData.currentUser.role==="ADMIN" };
}

export async function getTeamLocationStatuses(supabase: SupabaseClient, courtId: CourtId): Promise<TeamLocationStatus[]> {
  const { data, error } = await supabase.rpc("get_team_location_status", { p_court_id: courtId });
  if (error) throw new Error(`TEAM_LOCATION_STATUS_FAILED: ${error.message}`);
  return (data ?? []).map((row: {
    user_id: string;
    display_name: string;
    is_current_user: boolean;
    status: TeamLocationStatus["status"];
    expires_at: string | null;
  }) => ({
    userId: row.user_id,
    displayName: row.display_name,
    isCurrentUser: row.is_current_user,
    status: row.status,
    expiresAt: row.expires_at,
  }));
}
