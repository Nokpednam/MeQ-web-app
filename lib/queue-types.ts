import type { TeamType } from "./team-types";

export type CourtId = "3x3-a" | "3x3-b" | "5x5";
export type QueueEntryStatus = "WAITING" | "CALLED" | "CHECKING_IN" | "READY_TO_PLAY" | "PLAYING" | "DECIDING_CONTINUE" | "HOLDING_COURT" | "DECIDING_REQUEUE" | "MISSED_QUEUE" | "CANCELLED" | "AWAITING_SCORE" | "RESTING" | "RETURNING_CHAMPION" | "LEFT_QUEUE";

export type Court = {
  id: CourtId;
  name: "3x3 A" | "3x3 B" | "5x5";
  type: TeamType;
  requiredMembers: 3 | 5;
  image: string;
  isOpen: boolean;
  opensAt: "05:00";
  closesAt: "00:00";
  targetScore: number;
  allowedTargetScores: readonly number[];
};

export type QueueEntry = {
  id: string;
  courtId: CourtId;
  teamId: string;
  position: number;
  status: QueueEntryStatus;
  joinedAt: string;
  calledAt?: string;
  checkInDeadline?: string;
  missedAt?: string;
  missedReason?: "CHECK_IN_TIMEOUT";
};

export type QueueMemberSnapshot = { id: string; displayName: string; initials: string };

export type QueueTeamSnapshot = {
  id: string;
  name: string;
  type: TeamType;
  captainUserId?: string;
  memberCount: number;
  members: QueueMemberSnapshot[];
};

export type QueueDataState = {
  version: 1;
  entries: QueueEntry[];
  mockTeams: QueueTeamSnapshot[];
  locationInRange: boolean;
  lastResetAt?: string;
};

export type QueueRuleError =
  | "COURT_NOT_FOUND"
  | "COURT_CLOSED"
  | "TEAM_NOT_FOUND"
  | "TEAM_INCOMPLETE"
  | "INCOMPATIBLE_COURT"
  | "ALREADY_IN_QUEUE"
  | "ACTIVE_ON_OTHER_COURT"
  | "CAPTAIN_ONLY"
  | "OUT_OF_RANGE"
  | "QUEUE_ENTRY_NOT_FOUND"
  | "CANNOT_LEAVE_ACTIVE_STATE";

export type QueueMutationResult = { ok: true; entry?: QueueEntry } | { ok: false; error: QueueRuleError };
