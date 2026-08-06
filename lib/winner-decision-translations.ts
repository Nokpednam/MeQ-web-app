import type { DashboardLanguage } from "./dashboard-translations";

export const winnerDecisionTranslations: Record<DashboardLanguage, {
  title: string;
  hint: string;
  continuePlaying: string;
  stopPlaying: string;
  pending: string;
  continued: string;
  holdingCourt: string;
  restingOneGame: string;
  returningNext: string;
  left: string;
}> = {
  th: {
    title: "การตัดสินใจของทีมชนะ",
    hint: "หัวหน้าทีมชนะเลือกว่าจะอยู่เล่นต่อหรือออกจากสนาม",
    continuePlaying: "เล่นต่อ",
    stopPlaying: "ไม่เล่นต่อ",
    pending: "รอหัวหน้าทีมชนะตัดสินใจ",
    continued: "เลือกเล่นต่อแล้ว",
    holdingCourt: "เล่นต่อ · รอคู่แข่ง",
    restingOneGame: "ชนะ 2/2 · พัก 1 เกม",
    returningNext: "พักครบแล้ว · กลับเกมถัดไป",
    left: "เลือกไม่เล่นต่อแล้ว",
  },
  en: {
    title: "Winner decision",
    hint: "The winning captain chooses whether to stay or leave the court.",
    continuePlaying: "Keep playing",
    stopPlaying: "Stop playing",
    pending: "Waiting for the winning captain",
    continued: "Continuing on court",
    holdingCourt: "Staying on · waiting for opponent",
    restingOneGame: "Won 2/2 · resting one game",
    returningNext: "Rest complete · playing next",
    left: "Leaving the court",
  },
};
