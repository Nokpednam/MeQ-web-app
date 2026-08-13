import type { QueueCopy } from "./dashboard-translations";
import type { QueueRuleError } from "./queue-types";

export function getQueueErrorMessage(error: QueueRuleError, copy: QueueCopy): string {
  const messages: Record<QueueRuleError, string> = {
    COURT_NOT_FOUND: copy.courtNotFound,
    COURT_CLOSED: copy.courtClosed,
    TEAM_NOT_FOUND: copy.createTeam,
    TEAM_INCOMPLETE: copy.teamIncomplete,
    INCOMPATIBLE_COURT: copy.incompatibleCourt,
    ALREADY_IN_QUEUE: copy.alreadyInQueue,
    ACTIVE_ON_OTHER_COURT: copy.activeOtherCourt,
    CAPTAIN_ONLY: copy.captainOnly,
    OUT_OF_RANGE: copy.outOfRange,
    QUEUE_ENTRY_NOT_FOUND: copy.queueEntryNotFound,
    CANNOT_LEAVE_ACTIVE_STATE: copy.cannotLeaveActive,
  };
  return messages[error];
}
