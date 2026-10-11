import assert from "node:assert/strict";
import test from "node:test";
import { buildLineMessageText, buildLinePushBody, classifyLinePushStatus } from "../lib/line-messaging";

test("LINE push outcomes: success and duplicate retry key count as sent", () => {
  assert.equal(classifyLinePushStatus(200), "SENT");
  assert.equal(classifyLinePushStatus(409), "SENT");
});

test("LINE push outcomes: rate limits, server errors, and network errors are retried", () => {
  assert.equal(classifyLinePushStatus(429), "RETRY");
  assert.equal(classifyLinePushStatus(500), "RETRY");
  assert.equal(classifyLinePushStatus(503), "RETRY");
  assert.equal(classifyLinePushStatus(null), "RETRY");
});

test("LINE push outcomes: other client errors fail permanently", () => {
  assert.equal(classifyLinePushStatus(400), "FAILED");
  assert.equal(classifyLinePushStatus(401), "FAILED");
  assert.equal(classifyLinePushStatus(403), "FAILED");
});

test("LINE message text appends the app link only when both parts exist", () => {
  assert.equal(buildLineMessageText("ถึงคิวแล้ว", "/courts/5x5", "https://meq.example/"), "ถึงคิวแล้ว\n\nhttps://meq.example/courts/5x5");
  assert.equal(buildLineMessageText("ถึงคิวแล้ว", null, "https://meq.example"), "ถึงคิวแล้ว");
  assert.equal(buildLineMessageText("ถึงคิวแล้ว", "/courts/5x5", undefined), "ถึงคิวแล้ว");
  assert.equal(buildLineMessageText("ก".repeat(6000), null, undefined).length, 5000);
});

test("LINE push body sends one text message to the user", () => {
  assert.deepEqual(buildLinePushBody("U123", "hello"), { to: "U123", messages: [{ type: "text", text: "hello" }] });
});
