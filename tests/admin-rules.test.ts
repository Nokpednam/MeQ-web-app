import assert from "node:assert/strict";
import test from "node:test";
import { getCourtById } from "../lib/court-data";
import { createInitialAdminData } from "../lib/admin-repository";
import { getAdminCourt, setCourtOpen, setDailyTargetScore, updateMaintenanceStatus } from "../lib/admin-rules";
import type { AdminDataState } from "../lib/admin-types";

const court3A = getCourtById("3x3-a");
const court3B = getCourtById("3x3-b");
const court5 = getCourtById("5x5");
assert.ok(court3A && court3B && court5);

test("3x3 A and B share one daily target score", () => {
  const state = setDailyTargetScore(createInitialAdminData(), "3x3", 9);
  assert.ok(state);
  assert.equal(getAdminCourt(state, court3A).targetScore, 9);
  assert.equal(getAdminCourt(state, court3B).targetScore, 9);
  assert.equal(getAdminCourt(state, court5).targetScore, 15);
});

test("manual close is reflected by the effective court", () => {
  const state = setCourtOpen(createInitialAdminData(), "3x3-a", false);
  assert.equal(getAdminCourt(state, court3A).isOpen, false);
  assert.equal(getAdminCourt(state, court3B).isOpen, true);
});

test("an active event closes only its affected court and time", () => {
  const state = createInitialAdminData();
  const during = new Date(2026, 7, 8, 17, 0);
  const outside = new Date(2026, 7, 8, 21, 0);
  assert.equal(getAdminCourt(state, court5, during).isOpen, false);
  assert.equal(getAdminCourt(state, court3A, during).isOpen, true);
  assert.equal(getAdminCourt(state, court5, outside).isOpen, true);
});

test("maintenance status changes without mutating the original state", () => {
  const initial: AdminDataState = { ...createInitialAdminData(), maintenanceReports: [{ id: "report-1", courtId: "3x3-a", category: "SURFACE", details: "พื้นลื่น", status: "NEW", createdAt: "2026-08-10T00:00:00.000Z" }] };
  const updated = updateMaintenanceStatus(initial, "report-1", "IN_PROGRESS");
  assert.equal(initial.maintenanceReports[0].status, "NEW");
  assert.equal(updated.maintenanceReports[0].status, "IN_PROGRESS");
});
