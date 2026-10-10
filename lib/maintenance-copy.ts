import type { MaintenanceCategory, MaintenanceStatus } from "./admin-types";
import type { CourtId } from "./queue-types";

type Language = "th" | "en";

export const maintenanceCategoryCopy: Record<Language, Record<MaintenanceCategory, string>> = {
  th: { SURFACE: "พื้นสนาม", HOOP: "แป้นหรือห่วง", LIGHTING: "ระบบไฟ", OTHER: "อื่น ๆ" },
  en: { SURFACE: "Court surface", HOOP: "Backboard or hoop", LIGHTING: "Lighting", OTHER: "Other" },
};

export const maintenanceStatusCopy: Record<Language, Record<MaintenanceStatus, string>> = {
  th: {
    NEW: "รอแอดมินรับเรื่อง",
    IN_PROGRESS: "แอดมินรับเรื่องแล้ว",
    WAITING_FOR_CARETAKER: "รอผู้ดูแลสนามเข้ามาซ่อม",
    RESOLVED: "แก้ไขแล้ว",
    REJECTED: "ไม่รับเรื่อง",
  },
  en: {
    NEW: "Waiting for admin",
    IN_PROGRESS: "Admin accepted",
    WAITING_FOR_CARETAKER: "Waiting for court caretaker",
    RESOLVED: "Resolved",
    REJECTED: "Rejected",
  },
};

/** Labels for the admin status picker, phrased as the action the admin takes. */
export const maintenanceAdminStatusOptions: { value: MaintenanceStatus; label: string }[] = [
  { value: "NEW", label: "รายการใหม่" },
  { value: "IN_PROGRESS", label: "แอดมินรับเรื่องแล้ว" },
  { value: "WAITING_FOR_CARETAKER", label: "แจ้งผู้ดูแลแล้ว รอเข้ามาซ่อม" },
  { value: "RESOLVED", label: "แก้ไขแล้ว" },
  { value: "REJECTED", label: "ไม่รับเรื่อง (รายงานไม่ถูกต้อง)" },
];

const courtNames: Record<CourtId, string> = { "3x3-a": "3x3 A", "3x3-b": "3x3 B", "5x5": "5x5" };

export function maintenanceCourtName(courtId: string): string {
  return courtNames[courtId as CourtId] ?? courtId;
}

export function maintenanceCategoryLabel(category: string, language: Language = "th"): string {
  return maintenanceCategoryCopy[language][category as MaintenanceCategory] ?? category;
}
