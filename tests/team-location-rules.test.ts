import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextLocationExpiry,
  getTeamLocationSummary,
  isTeamLocationReady,
  type TeamLocationStatusLike,
} from "../lib/team-location-rules";

const now = Date.parse("2026-08-25T10:00:00.000Z");
const status = (expiresAt: string | null, state: TeamLocationStatusLike["status"] = "VERIFIED") => ({
  status: state,
  expiresAt,
});

test("verification is ready only before its server expiry", () => {
  assert.equal(isTeamLocationReady(status("2026-08-25T10:00:01.000Z"), now), true);
  assert.equal(isTeamLocationReady(status("2026-08-25T10:00:00.000Z"), now), false);
  assert.equal(isTeamLocationReady(status("2026-08-25T09:59:59.000Z"), now), false);
  assert.equal(isTeamLocationReady(status(null), now), false);
});

test("team readiness drops as soon as one member expires", () => {
  const members = [
    status("2026-08-25T10:10:00.000Z"),
    status("2026-08-25T10:05:00.000Z"),
    status("2026-08-25T10:00:00.000Z"),
  ];
  assert.deepEqual(getTeamLocationSummary(members, 3, now), {
    readyCount: 2,
    missingSlots: 0,
    allReady: false,
  });
});

test("an incomplete roster is never location-ready", () => {
  const members = [status("2026-08-25T10:10:00.000Z"), status("2026-08-25T10:10:00.000Z")];
  assert.deepEqual(getTeamLocationSummary(members, 3, now), {
    readyCount: 2,
    missingSlots: 1,
    allReady: false,
  });
});

test("the earliest valid expiry drives the next UI update", () => {
  const members = [
    status("2026-08-25T10:10:00.000Z"),
    status("2026-08-25T10:03:00.000Z"),
    status("2026-08-25T09:59:00.000Z"),
  ];
  assert.equal(getNextLocationExpiry(members, now), Date.parse("2026-08-25T10:03:00.000Z"));
});
