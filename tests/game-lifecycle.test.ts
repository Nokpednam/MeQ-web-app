import assert from "node:assert/strict";
import test from "node:test";
import { getActiveGameForCourt, isGameActive } from "../lib/game-lifecycle-rules";
import type { GameLifecycle } from "../lib/game-lifecycle-types";

function game(id: string, courtId: GameLifecycle["courtId"], status: GameLifecycle["status"], startedAt: string): GameLifecycle {
  return { id, courtId, status, startedAt } as GameLifecycle;
}

test("a game is active until it is completed or cancelled", () => {
  assert.equal(isGameActive(game("g1", "3x3-a", "PLAYING", "2026-10-13T10:00:00.000Z")), true);
  assert.equal(isGameActive(game("g1", "3x3-a", "END_REQUESTED", "2026-10-13T10:00:00.000Z")), true);
  assert.equal(isGameActive(game("g1", "3x3-a", "AWAITING_SCORE", "2026-10-13T10:00:00.000Z")), true);
  assert.equal(isGameActive(game("g1", "3x3-a", "VALIDATING_RESULT", "2026-10-13T10:00:00.000Z")), true);
  assert.equal(isGameActive(game("g1", "3x3-a", "INVALID_SCORE", "2026-10-13T10:00:00.000Z")), true);
  assert.equal(isGameActive(game("g1", "3x3-a", "COMPLETED", "2026-10-13T10:00:00.000Z")), false);
  assert.equal(isGameActive(game("g1", "3x3-a", "CANCELLED", "2026-10-13T10:00:00.000Z")), false);
});

test("the active game for a court is the latest active game on that court", () => {
  const games = [
    game("old", "3x3-a", "PLAYING", "2026-10-13T09:00:00.000Z"),
    game("new", "3x3-a", "PLAYING", "2026-10-13T10:00:00.000Z"),
    game("done", "3x3-a", "COMPLETED", "2026-10-13T11:00:00.000Z"),
    game("other", "3x3-b", "PLAYING", "2026-10-13T12:00:00.000Z"),
  ];
  assert.equal(getActiveGameForCourt(games, "3x3-a")?.id, "new");
  assert.equal(getActiveGameForCourt(games, "5x5"), undefined);
});
