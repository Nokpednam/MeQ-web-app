import type { Team, TeamRuleError, TeamStatus, TeamType, User } from "./team-types";

export const TEAM_CAPACITY_BY_TYPE: Record<TeamType, number> = {
  THREE_X_THREE: 3,
  FIVE_X_FIVE: 5,
};

export function normalizeTeamName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateTeamName(name: string): TeamRuleError | null {
  const normalized = normalizeTeamName(name);
  if (!normalized) return "TEAM_NAME_REQUIRED";
  if (normalized.length < 2 || normalized.length > 30) return "TEAM_NAME_LENGTH";
  return null;
}

export function getTeamCapacity(type: TeamType): number {
  return TEAM_CAPACITY_BY_TYPE[type];
}

export function getTeamStatus(team: Team): TeamStatus {
  return team.members.length === getTeamCapacity(team.type) ? "READY" : "INCOMPLETE";
}

export function canEditRoster(team: Team): boolean {
  return !team.rosterLocked;
}

export function canAddMember(team: Team, user: User): TeamRuleError | null {
  if (!canEditRoster(team)) return "ROSTER_LOCKED";
  if (team.members.length >= getTeamCapacity(team.type)) return "TEAM_FULL";
  if (team.members.some((member) => member.userId === user.id)) return "USER_ALREADY_MEMBER";
  if (user.currentTeamId !== null) return "USER_ALREADY_IN_TEAM";
  return null;
}

export function canRemoveMember(team: Team, actorUserId: string, targetUserId: string): TeamRuleError | null {
  if (!canEditRoster(team)) return "ROSTER_LOCKED";
  if (team.captainUserId !== actorUserId) return "CAPTAIN_ONLY";
  if (!team.members.some((member) => member.userId === targetUserId)) return "USER_NOT_MEMBER";
  if (actorUserId === targetUserId) return "CAPTAIN_CANNOT_REMOVE_SELF";
  return null;
}

export function canLeaveTeam(team: Team, userId: string): TeamRuleError | null {
  if (!canEditRoster(team)) return "ROSTER_LOCKED";
  if (!team.members.some((member) => member.userId === userId)) return "USER_NOT_MEMBER";
  if (team.captainUserId === userId) return "CAPTAIN_CANNOT_LEAVE";
  return null;
}

export function canTransferCaptain(team: Team, actorUserId: string, targetUserId: string): TeamRuleError | null {
  if (!canEditRoster(team)) return "ROSTER_LOCKED";
  if (team.captainUserId !== actorUserId) return "CAPTAIN_ONLY";
  if (!team.members.some((member) => member.userId === targetUserId)) return "USER_NOT_MEMBER";
  if (actorUserId === targetUserId) return "CAPTAIN_CANNOT_REMOVE_SELF";
  return null;
}
