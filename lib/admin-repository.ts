import type { AdminDataState } from "./admin-types";

export const ADMIN_STORAGE_KEY = "meq-admin-mvp-v1";
export interface AdminRepository { load(): AdminDataState; save(state: AdminDataState): void; reset(): AdminDataState }

export function createInitialAdminData(): AdminDataState {
  return { version: 1, courts: [{ courtId: "3x3-a", isOpen: true }, { courtId: "3x3-b", isOpen: true }, { courtId: "5x5", isOpen: true }], targetScores: { threeXThree: 7, fiveXFive: 15 }, events: [
    { id: "event-aug-08", title: "งดใช้ Full Court 2", details: "กิจกรรมมหาวิทยาลัย", date: "2026-08-08", startTime: "16:00", endTime: "20:00", allDay: false, courtIds: ["5x5"], impact: "HIGH", status: "ACTIVE", createdAt: "2026-08-01T02:00:00.000Z" },
    { id: "event-aug-12", title: "ตรวจระบบไฟ", details: "อาจปิดสนามชั่วคราว", date: "2026-08-12", startTime: "09:00", endTime: "10:30", allDay: false, courtIds: ["3x3-a", "3x3-b"], impact: "MEDIUM", status: "ACTIVE", createdAt: "2026-08-01T02:10:00.000Z" },
    { id: "event-aug-18", title: "ทำความสะอาดพื้นสนาม", details: "งดใช้ทุกสนาม", date: "2026-08-18", startTime: "05:00", endTime: "08:00", allDay: false, courtIds: ["3x3-a", "3x3-b", "5x5"], impact: "HIGH", status: "ACTIVE", createdAt: "2026-08-01T02:20:00.000Z" },
  ], maintenanceReports: [] };
}

function isAdminDataState(value: unknown): value is AdminDataState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<AdminDataState>;
  return state.version === 1 && Array.isArray(state.courts) && Array.isArray(state.events) && Array.isArray(state.maintenanceReports) && Boolean(state.targetScores);
}

export class LocalStorageAdminRepository implements AdminRepository {
  load(): AdminDataState { try { const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY); if (!raw) return this.reset(); const parsed: unknown = JSON.parse(raw); return isAdminDataState(parsed) ? parsed : this.reset(); } catch { return this.reset(); } }
  save(state: AdminDataState): void { window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state)); }
  reset(): AdminDataState { const state = createInitialAdminData(); this.save(state); return state; }
}

