import type { DashboardLanguage } from "./dashboard-translations";

export const gameFlowTranslations = {
  th: {
    endAndScore: "จบเกมและกรอกคะแนน",
    confirmByScores: "กรอกคะแนนทีมฉันเพื่อยืนยัน",
    rejectEnd: "เกมยังไม่จบ",
    waitingOpponentScore: "ส่งคะแนนทีมคุณได้เลย แล้วระบบจะรออีกทีมยืนยันด้วยการส่งคะแนน",
    opponentRequestedEnd: "อีกทีมขอจบเกม การส่งคะแนนของทีมคุณจะยืนยันว่าจบเกมแล้ว",
    requesterScoreHint: "คุณเป็นผู้ขอจบเกม ส่งคะแนนทีมคุณแล้วรออีกทีมยืนยัน",
    opponentScoreConfirms: "อีกทีมขอจบเกม การส่งคะแนนครั้งนี้ถือเป็นการยืนยันจบเกม",
  },
  en: {
    endAndScore: "End game and enter scores",
    confirmByScores: "Enter my team scores to confirm",
    rejectEnd: "Game is not over",
    waitingOpponentScore: "Submit your team scores now. The other team confirms by submitting theirs.",
    opponentRequestedEnd: "The other team requested the end. Submitting your scores confirms the game is over.",
    requesterScoreHint: "You requested the end. Submit your team scores and wait for the other team.",
    opponentScoreConfirms: "The other team requested the end. This score submission confirms the game is over.",
  },
} as const satisfies Record<DashboardLanguage, Record<string, string>>;
