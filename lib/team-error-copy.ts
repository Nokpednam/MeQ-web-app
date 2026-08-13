import type { TeamCopy } from "./dashboard-translations";
import type { TeamRuleError } from "./team-types";

export function getTeamErrorMessage(error: TeamRuleError, copy: TeamCopy): string {
  const messages: Record<TeamRuleError, string> = {
    TEAM_NAME_REQUIRED: copy.nameRequired,
    TEAM_NAME_LENGTH: copy.nameLength,
    USER_ALREADY_IN_TEAM: copy.errorAlreadyInTeam,
    TEAM_FULL: copy.errorTeamFull,
    USER_ALREADY_MEMBER: copy.errorAlreadyMember,
    ROSTER_LOCKED: copy.errorRosterLocked,
    CAPTAIN_ONLY: copy.errorCaptainOnly,
    CAPTAIN_CANNOT_LEAVE: copy.errorCaptainLeave,
    CAPTAIN_CANNOT_REMOVE_SELF: copy.errorCaptainRemoveSelf,
    USER_NOT_MEMBER: copy.errorNotMember,
    TEAM_NOT_FOUND: copy.errorTeamNotFound,
    USER_NOT_FOUND: copy.errorUserNotFound,
  };
  return messages[error];
}
