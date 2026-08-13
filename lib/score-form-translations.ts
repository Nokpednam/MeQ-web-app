import type { DashboardLanguage } from "./dashboard-translations";

export const scoreFormTranslations: Record<
  DashboardLanguage,
  {
    zeroIsValid: string;
    noTeamReachedTarget: string;
    waitingForOtherTeam: string;
    validating: string;
    saved: string;
  }
> = {
  th: {
    zeroIsValid: "ผู้เล่นที่ไม่ได้ทำแต้มให้กรอก 0 ซึ่งถือว่ากรอกคะแนนครบแล้ว",
    noTeamReachedTarget:
      "คะแนน 0 ของผู้เล่นใช้ได้ แต่ผลรวมของเกมต้องมีหนึ่งทีมถึงหรือเกินคะแนนเป้าหมาย",
    waitingForOtherTeam: "ส่งคะแนนเรียบร้อยแล้ว กำลังรออีกทีมส่งคะแนน",
    validating: "กำลังตรวจสอบคะแนน",
    saved: "บันทึกผลการแข่งขันสำเร็จ",
  },
  en: {
    zeroIsValid:
      "Enter 0 for a player who did not score; it still counts as a completed entry.",
    noTeamReachedTarget:
      "Individual players may score 0, but one team total must reach or exceed the target.",
    waitingForOtherTeam: "Scores submitted. Waiting for the other team.",
    validating: "Validating scores",
    saved: "Game result saved",
  },
};
