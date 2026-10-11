import assert from "node:assert/strict";
import test from "node:test";
import { secondsSince, shouldRefreshNow } from "../lib/live-refresh-rules";

const visible = { documentHidden: false, online: true, activeTagName: "BODY", activeIsContentEditable: false };

test("live refresh runs while the page is visible and idle", () => {
  assert.equal(shouldRefreshNow(visible), true);
  assert.equal(shouldRefreshNow({ ...visible, activeTagName: "BUTTON" }), true);
  assert.equal(shouldRefreshNow({ ...visible, activeTagName: null }), true);
});

test("live refresh pauses for hidden tabs and offline devices", () => {
  assert.equal(shouldRefreshNow({ ...visible, documentHidden: true }), false);
  assert.equal(shouldRefreshNow({ ...visible, online: false }), false);
});

test("live refresh never interrupts typing", () => {
  for (const tag of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
    assert.equal(shouldRefreshNow({ ...visible, activeTagName: tag }), false, tag);
  }
  assert.equal(shouldRefreshNow({ ...visible, activeTagName: "DIV", activeIsContentEditable: true }), false);
});

test("seconds since last refresh never goes negative", () => {
  assert.equal(secondsSince(10_000, 22_900), 12);
  assert.equal(secondsSince(10_000, 9_000), 0);
});
