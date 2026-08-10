import type { CourtId } from "./queue-types";

export type AdminCourtSetting = { courtId: CourtId; isOpen: boolean };
export type AdminEventImpact = "LOW" | "MEDIUM" | "HIGH";
export type AdminEventStatus = "ACTIVE" | "CANCELLED";
export type AdminEvent = { id: string; title: string; details: string; date: string; startTime: string; endTime: string; allDay: boolean; courtIds: CourtId[]; impact: AdminEventImpact; status: AdminEventStatus; createdAt: string };
export type MaintenanceCategory = "SURFACE" | "HOOP" | "LIGHTING" | "OTHER";
export type MaintenanceStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";
export type MaintenanceReport = { id: string; courtId: CourtId; category: MaintenanceCategory; details: string; imageName?: string; status: MaintenanceStatus; createdAt: string };
export type AdminDataState = { version: 1; courts: AdminCourtSetting[]; targetScores: { threeXThree: 7 | 9 | 11; fiveXFive: 11 | 15 | 21 }; events: AdminEvent[]; maintenanceReports: MaintenanceReport[] };

