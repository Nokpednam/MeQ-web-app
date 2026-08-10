import type { CourtId, QueueMemberSnapshot } from "./queue-types";

export type LocationStatus = "WITHIN_RANGE" | "OUT_OF_RANGE" | "PERMISSION_DENIED";
export type CheckInStatus = "CALLED" | "CHECKING_IN" | "READY_TO_PLAY" | "MISSED_QUEUE" | "PLAYING";

export type MemberCheckIn = {
  userId: string;
  checkedInAt: string;
  locationStatus: "WITHIN_RANGE";
};

export type TeamCheckInSession = {
  id: string;
  queueEntryId: string;
  courtId: CourtId;
  teamId: string;
  teamName: string;
  captainUserId?: string;
  members: QueueMemberSnapshot[];
  status: CheckInStatus;
  calledAt: string;
  checkInDeadline: string;
  checkIns: MemberCheckIn[];
  missedAt?: string;
  missedReason?: "CHECK_IN_TIMEOUT";
};

export type MockGame = {
  id: string;
  courtId: CourtId;
  teamAId: string;
  teamAName: string;
  teamAMembers: QueueMemberSnapshot[];
  teamAConsecutiveWinsBefore?: number;
  teamBId: string;
  teamBName: string;
  teamBMembers: QueueMemberSnapshot[];
  teamBConsecutiveWinsBefore?: number;
  targetScore: number;
  startedAt: string;
  status: "PLAYING";
  isRestGame?: boolean;
  restingChampionTeamId?: string;
};

export type CheckInDataState = {
  version: 1;
  activeMockUserId: string | null;
  locations: Record<string, LocationStatus>;
  sessions: TeamCheckInSession[];
  games: MockGame[];
};

export type CheckInError = "NO_WAITING_TEAM" | "TEAM_ALREADY_CALLED" | "SESSION_NOT_FOUND" | "MEMBER_NOT_IN_TEAM" | "NOT_CAPTAIN" | "ALREADY_CHECKED_IN" | "NOT_CHECKED_IN" | "OUT_OF_RANGE" | "PERMISSION_DENIED" | "DEADLINE_EXPIRED" | "CANNOT_CANCEL" | "NOT_ENOUGH_READY_TEAMS" | "GAME_ALREADY_ACTIVE";

export type CheckInResult = { ok: true; session?: TeamCheckInSession; game?: MockGame } | { ok: false; error: CheckInError };
