// Thai labels for database game and queue states. Kept free of Next and
// Supabase imports so the Node rule tests can cover them.

const gameStatusTh: Record<string, string> = {
  PLAYING: "กำลังแข่ง",
  END_REQUESTED: "ขอจบเกมแล้ว รอส่งคะแนน",
  AWAITING_SCORE: "รออีกทีมส่งคะแนน",
  VALIDATING_RESULT: "กำลังตรวจผล",
  INVALID_SCORE: "คะแนนไม่ผ่าน ต้องส่งใหม่",
  COMPLETED: "จบเกมแล้ว",
  CANCELLED: "เกมไม่มีผล",
};

export function gameStatusLabel(status: string): string {
  return gameStatusTh[status] ?? status;
}

/** Why a score submission was rejected, in words a player understands. */
export function invalidScoreReason(reason: string | null, targetScore: number): string {
  switch (reason) {
    case "TIED_SCORE": return "คะแนนรวมสองทีมเท่ากัน ต้องมีทีมชนะ";
    case "NO_TEAM_REACHED_TARGET": return `ยังไม่มีทีมไหนถึง ${targetScore} แต้ม`;
    case "BOTH_TEAMS_REACHED_TARGET": return `ทั้งสองทีมถึง ${targetScore} แต้ม ต้องมีทีมเดียวที่ถึงเป้าหมาย`;
    default: return "คะแนนไม่ผ่านการตรวจสอบ";
  }
}

const queueStatusTh: Record<string, string> = {
  WAITING: "รอคิว",
  CALLED: "ถึงคิว รอเช็กอิน",
  CHECKING_IN: "กำลังเช็กอิน",
  READY_TO_PLAY: "พร้อมเล่น",
  PLAYING: "กำลังแข่ง",
  AWAITING_SCORE: "กำลังแข่ง",
  DECIDING_CONTINUE: "ทีมชนะกำลังเลือกว่าจะเล่นต่อ",
  HOLDING_COURT: "ทีมชนะครองสนาม รอผู้ท้าชิง",
  RESTING: "ชนะ 2 เกมติด พัก 1 เกม",
  DECIDING_REQUEUE: "ทีมแพ้กำลังเลือกว่าจะต่อคิว",
  RETURNING_CHAMPION: "กลับมาเป็นคิวแรก",
  LEFT_QUEUE: "ออกจากคิวแล้ว",
  MISSED_QUEUE: "ไม่ได้เช็กอินทันเวลา ออกจากคิวแล้ว",
  CANCELLED: "ออกจากคิวแล้ว",
};

export function queueStatusLabel(status: string): string {
  return queueStatusTh[status] ?? status;
}
