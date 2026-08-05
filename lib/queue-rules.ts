import { getTeamStatus } from "./team-rules";
import type { Team } from "./team-types";
import type { Court, CourtId, QueueDataState, QueueEntry, QueueMutationResult, QueueRuleError } from "./queue-types";

const ACTIVE_STATUSES = new Set(["WAITING", "CALLED", "READY_TO_PLAY", "PLAYING", "AWAITING_SCORE", "RESTING"] as const);
const NON_LEAVABLE_STATUSES = new Set(["PLAYING", "AWAITING_SCORE", "RESTING"] as const);

export function isTeamCompatibleWithCourt(team: Team, court: Court): boolean {
  return team.type === court.type;
}

export function getActiveQueueEntryForTeam(entries: QueueEntry[], teamId: string): QueueEntry | null {
  return entries.find((entry) => entry.teamId === teamId && ACTIVE_STATUSES.has(entry.status)) ?? null;
}

export function getQueuePosition(entries: QueueEntry[], teamId: string): number | null {
  return getActiveQueueEntryForTeam(entries, teamId)?.position ?? null;
}

export function canEditTeamWhileQueued(entries: QueueEntry[], teamId: string): boolean {
  return getActiveQueueEntryForTeam(entries, teamId) === null;
}

export function canTeamJoinCourt(options: {
  team: Team | null;
  court: Court | null;
  entries: QueueEntry[];
  actorUserId: string;
  locationInRange: boolean;
}): QueueRuleError | null {
  const { team, court, entries, actorUserId, locationInRange } = options;
  if (!court) return "COURT_NOT_FOUND";
  if (!team) return "TEAM_NOT_FOUND";
  if (!court.isOpen) return "COURT_CLOSED";
  if (team.captainUserId !== actorUserId) return "CAPTAIN_ONLY";
  if (getTeamStatus(team) !== "READY") return "TEAM_INCOMPLETE";
  if (!isTeamCompatibleWithCourt(team, court)) return "INCOMPATIBLE_COURT";
  if (!locationInRange) return "OUT_OF_RANGE";
  const activeEntry = getActiveQueueEntryForTeam(entries, team.id);
  if (activeEntry?.courtId === court.id) return "ALREADY_IN_QUEUE";
  if (activeEntry) return "ACTIVE_ON_OTHER_COURT";
  return null;
}

export function reorderQueuePositions(entries: QueueEntry[], courtId: CourtId): QueueEntry[] {
  const courtEntries = entries
    .filter((entry) => entry.courtId === courtId && entry.status !== "PLAYING" && entry.status !== "AWAITING_SCORE")
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  const positions = new Map(courtEntries.map((entry, index) => [entry.id, index + 1]));
  return entries.map((entry) => entry.courtId === courtId && positions.has(entry.id) ? { ...entry, position: positions.get(entry.id) ?? entry.position } : entry);
}

export function joinQueue(state: QueueDataState, team: Team, court: Court, actorUserId: string, joinedAt: string): { state: QueueDataState; result: QueueMutationResult } {
  const ruleError = canTeamJoinCourt({ team, court, entries: state.entries, actorUserId, locationInRange: state.locationInRange });
  if (ruleError) return { state, result: { ok: false, error: ruleError } };
  const entry: QueueEntry = {
    id: `queue-${crypto.randomUUID()}`,
    courtId: court.id,
    teamId: team.id,
    position: state.entries.filter((item) => item.courtId === court.id && item.status !== "PLAYING" && item.status !== "AWAITING_SCORE").length + 1,
    status: "WAITING",
    joinedAt,
  };
  const entries = reorderQueuePositions([...state.entries, entry], court.id);
  return { state: { ...state, entries }, result: { ok: true, entry: entries.find((item) => item.id === entry.id) } };
}

export function leaveQueue(state: QueueDataState, teamId: string, actorUserId: string, captainUserId: string): { state: QueueDataState; result: QueueMutationResult } {
  if (actorUserId !== captainUserId) return { state, result: { ok: false, error: "CAPTAIN_ONLY" } };
  const activeEntry = getActiveQueueEntryForTeam(state.entries, teamId);
  if (!activeEntry) return { state, result: { ok: false, error: "QUEUE_ENTRY_NOT_FOUND" } };
  if (NON_LEAVABLE_STATUSES.has(activeEntry.status as "PLAYING" | "AWAITING_SCORE" | "RESTING")) {
    return { state, result: { ok: false, error: "CANNOT_LEAVE_ACTIVE_STATE" } };
  }
  const entries = reorderQueuePositions(state.entries.filter((entry) => entry.id !== activeEntry.id), activeEntry.courtId);
  return { state: { ...state, entries }, result: { ok: true } };
}
