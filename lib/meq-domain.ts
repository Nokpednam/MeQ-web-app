export const COURT_TYPES = ["THREE_X_THREE", "FIVE_X_FIVE"] as const;
export type CourtType = (typeof COURT_TYPES)[number];

export const TEAM_STATES = [
  "INCOMPLETE",
  "READY",
  "WAITING",
  "CHECK_IN_REQUIRED",
  "READY_TO_PLAY",
  "PLAYING",
  "SUBMITTING_SCORE",
  "RESTING",
  "RETURNING_CHAMPION",
  "DECIDING_REQUEUE",
  "MISSED_QUEUE",
  "LEFT_QUEUE",
] as const;
export type TeamState = (typeof TEAM_STATES)[number];

export const TEAM_CAPACITY: Record<CourtType, number> = {
  THREE_X_THREE: 3,
  FIVE_X_FIVE: 5,
};

export const ALLOWED_TARGET_SCORES: Record<CourtType, readonly number[]> = {
  THREE_X_THREE: [7, 9, 11],
  FIVE_X_FIVE: [11, 15, 21],
};

export const DAILY_DEFAULT_TARGET_SCORE: Record<CourtType, number> = {
  THREE_X_THREE: 7,
  FIVE_X_FIVE: 15,
};

export const BUSINESS_DAY_START_HOUR = 5;
export const COURT_CLOSE_HOUR = 24;
export const LOSER_DECISION_SECONDS = 180;
export const CHECK_IN_SECONDS = 180; // ค่าเริ่มต้นชั่วคราว ปรับได้ภายหลัง
export const MAX_CONSECUTIVE_WINS = 2;
export const REST_GAMES_AFTER_STREAK = 1;

export function isTeamComplete(type: CourtType, memberCount: number): boolean {
  return memberCount === TEAM_CAPACITY[type];
}

export function isAllowedTargetScore(type: CourtType, score: number): boolean {
  return ALLOWED_TARGET_SCORES[type].includes(score);
}

export function canEditRoster(state: TeamState): boolean {
  return state === "INCOMPLETE" || state === "READY" || state === "LEFT_QUEUE";
}

export function getWinner(teamAScore: number, teamBScore: number, targetScore: number): "A" | "B" | null {
  if (teamAScore === teamBScore) return null;
  if (teamAScore >= targetScore && teamAScore > teamBScore) return "A";
  if (teamBScore >= targetScore && teamBScore > teamAScore) return "B";
  return null;
}
