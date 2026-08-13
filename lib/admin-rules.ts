import type { AdminDataState, AdminEvent, MaintenanceReport, MaintenanceStatus } from "./admin-types";
import type { Court, CourtId } from "./queue-types";

export function getAdminCourt(state: AdminDataState, court: Court, at = new Date()): Court {
  const setting = state.courts.find((item) => item.courtId === court.id);
  const dateKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  const timeKey = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const eventClosed = state.events.some((event) => event.status === "ACTIVE" && event.date === dateKey && event.courtIds.includes(court.id) && (event.allDay || (timeKey >= event.startTime && timeKey < event.endTime)));
  return { ...court, isOpen: Boolean(setting?.isOpen) && !eventClosed, targetScore: court.type === "THREE_X_THREE" ? state.targetScores.threeXThree : state.targetScores.fiveXFive };
}

export function setCourtOpen(state: AdminDataState, courtId: CourtId, isOpen: boolean): AdminDataState {
  return { ...state, courts: state.courts.map((court) => court.courtId === courtId ? { ...court, isOpen } : court) };
}

export function setDailyTargetScore(state: AdminDataState, format: "3x3" | "5x5", score: number): AdminDataState | null {
  if (format === "3x3" && ([7, 9, 11] as number[]).includes(score)) return { ...state, targetScores: { ...state.targetScores, threeXThree: score as 7 | 9 | 11 } };
  if (format === "5x5" && ([11, 15, 21] as number[]).includes(score)) return { ...state, targetScores: { ...state.targetScores, fiveXFive: score as 11 | 15 | 21 } };
  return null;
}

export function addAdminEvent(state: AdminDataState, event: AdminEvent): AdminDataState { return { ...state, events: [...state.events, event] }; }
export function updateAdminEvent(state: AdminDataState, eventId: string, input: Omit<AdminEvent, "id" | "status" | "createdAt">): AdminDataState { return { ...state, events: state.events.map((event) => event.id === eventId ? { ...event, ...input } : event) }; }
export function cancelAdminEvent(state: AdminDataState, eventId: string): AdminDataState { return { ...state, events: state.events.map((event) => event.id === eventId ? { ...event, status: "CANCELLED" } : event) }; }
export function addMaintenanceReport(state: AdminDataState, report: MaintenanceReport): AdminDataState { return { ...state, maintenanceReports: [report, ...state.maintenanceReports] }; }
export function updateMaintenanceStatus(state: AdminDataState, reportId: string, status: MaintenanceStatus): AdminDataState { return { ...state, maintenanceReports: state.maintenanceReports.map((report) => report.id === reportId ? { ...report, status } : report) }; }
