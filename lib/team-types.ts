export type TeamType = "THREE_X_THREE" | "FIVE_X_FIVE";
export type TeamStatus = "INCOMPLETE" | "READY";
export type TeamMemberRole = "CAPTAIN" | "MEMBER";

export type User = {
  id: string;
  displayName: string;
  initials: string;
  currentTeamId: string | null;
};

export type TeamMember = {
  userId: string;
  role: TeamMemberRole;
  joinedAt: string;
};

export type Team = {
  id: string;
  name: string;
  type: TeamType;
  captainUserId: string;
  members: TeamMember[];
  rosterLocked: boolean;
  createdAt: string;
};

export type TeamDataState = {
  currentUserId: string;
  users: User[];
  teams: Team[];
};

export type TeamRuleError =
  | "TEAM_NAME_REQUIRED"
  | "TEAM_NAME_LENGTH"
  | "USER_ALREADY_IN_TEAM"
  | "TEAM_FULL"
  | "USER_ALREADY_MEMBER"
  | "ROSTER_LOCKED"
  | "CAPTAIN_ONLY"
  | "CAPTAIN_CANNOT_LEAVE"
  | "CAPTAIN_CANNOT_REMOVE_SELF"
  | "USER_NOT_MEMBER"
  | "TEAM_NOT_FOUND"
  | "USER_NOT_FOUND";

export type TeamMutationResult = { ok: true; teamId?: string } | { ok: false; error: TeamRuleError };
