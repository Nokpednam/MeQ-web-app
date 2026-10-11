import assert from "node:assert/strict";
import test from "node:test";
import { bucketPercent, formatMaintenanceHours, parseMaintenanceStatsPeriod } from "../lib/maintenance-stats";

test("maintenance durations use minutes, hours, then days", () => {
  assert.equal(formatMaintenanceHours(null), "–");
  assert.equal(formatMaintenanceHours(0.004), "1 นาที");
  assert.equal(formatMaintenanceHours(0.75), "45 นาที");
  assert.equal(formatMaintenanceHours(5.46), "5.5 ชม.");
  assert.equal(formatMaintenanceHours(55), "2.3 วัน");
});

test("maintenance stats period defaults to 30 days", () => {
  assert.equal(parseMaintenanceStatsPeriod(undefined), 30);
  assert.equal(parseMaintenanceStatsPeriod("7"), 7);
  assert.equal(parseMaintenanceStatsPeriod("all"), null);
  assert.equal(parseMaintenanceStatsPeriod("999"), 30);
});

test("bar widths are relative to the largest bucket", () => {
  const buckets = [{ key: "5x5", total: 4 }, { key: "3x3-a", total: 1 }];
  assert.equal(bucketPercent(4, buckets), 100);
  assert.equal(bucketPercent(1, buckets), 25);
  assert.equal(bucketPercent(0, []), 0);
});
