import assert from "node:assert/strict";
import test from "node:test";
import {
  closeGameCheckInSession,
  confirmEndByScoreSubmission,
  chooseWinnerContinuation,
  getActiveGameForCourt,
  isGameActive,
  processCompletedGame,
  processSubmittedGame,
  rejectEndGameRequest,
  requestEndGame,
  saveScoreDraft,
  synchronizeHoldingWinnerEntry,
} from "../lib/game-lifecycle-rules";
import type {
  GameLifecycle,
  PlayerGameHistory,
  ScoreSubmission,
} from "../lib/game-lifecycle-types";
import type { CheckInDataState } from "../lib/check-in-types";
import type { QueueDataState } from "../lib/queue-types";
import { callNextTeam, confirmTeamReady, startMockGame } from "../lib/check-in-rules";
import { getCourtById } from "../lib/court-data";

const members = (prefix: string) => [0, 1, 2].map((index) => ({
  id: `${prefix}${index}`,
  displayName: `${prefix}${index}`,
  initials: prefix.toUpperCase(),
}));

function createGame(): GameLifecycle {
  return {
    id: "game-sync-test",
    courtId: "3x3-b",
    teamA: { teamId: "black", teamName: "Black Cat", captainUserId: "a0", members: members("a"), consecutiveWinsBefore: 0 },
    teamB: { teamId: "air", teamName: "Air Ball", captainUserId: "b0", members: members("b"), consecutiveWinsBefore: 0 },
    targetScore: 7,
    startedAt: "2026-08-06T01:00:00.000Z",
    status: "AWAITING_SCORE",
    isRestGame: false,
  };
}

function submission(teamId: "black" | "air", prefix: "a" | "b", points: number[]): ScoreSubmission {
  return {
    id: `submission-${teamId}`,
    gameId: "game-sync-test",
    teamId,
    submittedByUserId: `${prefix}0`,
    status: "SUBMITTED",
    submittedAt: "2026-08-06T01:10:00.000Z",
    updatedAt: "2026-08-06T01:10:00.000Z",
    playerScores: points.map((score, index) => ({ gameId: "game-sync-test", teamId, playerId: `${prefix}${index}`, points: score })),
  };
}

function queueState(): QueueDataState {
  return {
    version: 1,
    locationInRange: true,
    mockTeams: [],
    entries: [
      { id: "entry-black", courtId: "3x3-b", teamId: "black", position: 0, status: "PLAYING", joinedAt: "2026-08-06T00:30:00.000Z" },
      { id: "entry-air", courtId: "3x3-b", teamId: "air", position: 0, status: "PLAYING", joinedAt: "2026-08-06T00:31:00.000Z" },
      { id: "entry-next", courtId: "3x3-b", teamId: "next", position: 1, status: "WAITING", joinedAt: "2026-08-06T00:32:00.000Z" },
    ],
  };
}

function checkInState(): CheckInDataState {
  const game = createGame();
  return {
    version: 1,
    activeMockUserId: null,
    locations: {},
    sessions: [game.teamA, game.teamB].map((team, index) => ({
      id: `checkin-${index}`,
      queueEntryId: index === 0 ? "entry-black" : "entry-air",
      courtId: game.courtId,
      teamId: team.teamId,
      teamName: team.teamName,
      members: team.members,
      status: "PLAYING" as const,
      calledAt: game.startedAt,
      checkInDeadline: game.startedAt,
      checkIns: [],
    })),
    games: [{
      id: game.id,
      courtId: game.courtId,
      teamAId: game.teamA.teamId,
      teamAName: game.teamA.teamName,
      teamAMembers: game.teamA.members,
      teamBId: game.teamB.teamId,
      teamBName: game.teamB.teamName,
      teamBMembers: game.teamB.members,
      targetScore: game.targetScore,
      startedAt: game.startedAt,
      status: "PLAYING",
    }],
  };
}

test("one captain action confirms the entire roster while a member cannot", () => {
  const queue: QueueDataState = {
    version: 1,
    locationInRange: true,
    entries: [{ id: "ready-entry", courtId: "3x3-a", teamId: "falcon", position: 1, status: "WAITING", joinedAt: "2026-08-06T00:00:00.000Z" }],
    mockTeams: [],
  };
  const state: CheckInDataState = { version: 1, activeMockUserId: null, locations: {}, sessions: [], games: [] };
  const team = { id: "falcon", name: "Falcon", type: "THREE_X_THREE" as const, memberCount: 3, members: members("c") };
  const called = callNextTeam(queue, state, "3x3-a", team, "2026-08-06T00:01:00.000Z");
  assert.equal(called.result.ok, true);
  if (!called.result.ok || !called.result.session) return;
  const denied = confirmTeamReady(called.queueState, called.checkInState, called.result.session.id, "c1", {}, "2026-08-06T00:01:10.000Z");
  assert.deepEqual(denied.result, { ok: false, error: "NOT_CAPTAIN" });
  const confirmed = confirmTeamReady(called.queueState, called.checkInState, called.result.session.id, "c0", {}, "2026-08-06T00:01:10.000Z");
  assert.equal(confirmed.result.ok, true);
  assert.equal(confirmed.result.ok && confirmed.result.session?.status, "READY_TO_PLAY");
  assert.equal(confirmed.result.ok && confirmed.result.session?.checkIns.length, 3);
});

test("opponent score submission confirms an end request without a separate confirmation", () => {
  const playing = { ...createGame(), status: "PLAYING" as const };
  const requested = requestEndGame(playing, "a0", "2026-08-06T01:08:00.000Z");
  assert.equal(requested.ok, true);
  if (!requested.ok) return;
  const requesterDraft = saveScoreDraft(requested.game, undefined, "black", "a0", { a0: 7, a1: 0, a2: 0 }, "2026-08-06T01:09:00.000Z");
  assert.equal(requesterDraft.error, undefined);
  const confirmed = confirmEndByScoreSubmission(requested.game, "air", "b0");
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.ok && confirmed.game.status, "AWAITING_SCORE");
  assert.equal(confirmed.ok && confirmed.game.confirmedByUserId, "b0");
});

test("opposing captain can reject an end request", () => {
  const requested = requestEndGame({ ...createGame(), status: "PLAYING" }, "a0", "2026-08-06T01:08:00.000Z");
  assert.equal(requested.ok, true);
  if (!requested.ok) return;
  const rejected = rejectEndGameRequest(requested.game, "b0");
  assert.equal(rejected.ok, true);
  assert.equal(rejected.ok && rejected.game.status, "PLAYING");
  assert.equal(rejected.ok && rejected.game.requestedByTeamId, undefined);
});

test("finalize synchronizes active game, queue, check-in, result, and statistics", () => {
  const game = createGame();
  const result = processSubmittedGame(
    game,
    submission("black", "a", [7, 0, 0]),
    submission("air", "b", [2, 0, 0]),
    queueState(),
    [],
    [],
    "2026-08-06T01:11:00.000Z",
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const games = [result.game];
  assert.equal(isGameActive(result.game), false);
  assert.equal(getActiveGameForCourt(games, "3x3-b"), undefined);
  assert.deepEqual(games.filter((item) => item.status === "COMPLETED").map((item) => item.id), [game.id]);
  assert.equal(result.queue.entries.some((entry) => entry.status === "PLAYING"), false);
  assert.equal(result.queue.entries.find((entry) => entry.teamId === "black")?.status, "DECIDING_CONTINUE");
  assert.equal(result.queue.entries.find((entry) => entry.teamId === "air")?.status, "DECIDING_REQUEUE");
  assert.equal(result.history.length, 6);

  const winnerLeaves = chooseWinnerContinuation(result.game, result.queue, "a0", false, "2026-08-06T01:11:30.000Z");
  assert.equal(winnerLeaves.error, undefined);
  assert.equal(winnerLeaves.game?.postGame?.winnerContinuationDecision, "LEAVE");
  assert.equal(winnerLeaves.queue?.entries.find((entry) => entry.teamId === "black")?.status, "LEFT_QUEUE");

  const queueWithoutWinner = { ...result.queue, entries: result.queue.entries.filter((entry) => entry.teamId !== "black") };
  const winnerContinues = chooseWinnerContinuation(result.game, queueWithoutWinner, "a0", true, "2026-08-06T01:11:30.000Z");
  assert.equal(winnerContinues.error, undefined);
  assert.equal(winnerContinues.queue?.entries.find((entry) => entry.teamId === "black")?.status, "HOLDING_COURT");
  const repairedQueue = synchronizeHoldingWinnerEntry([winnerContinues.game!], { ...winnerContinues.queue!, entries: winnerContinues.queue!.entries.filter((entry) => entry.teamId !== "black") }, "2026-08-06T01:12:00.000Z");
  assert.equal(repairedQueue.entries.find((entry) => entry.teamId === "black")?.status, "HOLDING_COURT");
  const explicitlyResetQueue = synchronizeHoldingWinnerEntry([winnerContinues.game!], { ...winnerContinues.queue!, lastResetAt: "2026-08-06T01:13:00.000Z", entries: winnerContinues.queue!.entries.filter((entry) => entry.teamId !== "black") }, "2026-08-06T01:14:00.000Z");
  assert.equal(explicitlyResetQueue.entries.some((entry) => entry.teamId === "black"), false);

  const closedCheckIn = closeGameCheckInSession(checkInState(), result.game);
  assert.equal(closedCheckIn.games.length, 0);
  assert.equal(closedCheckIn.sessions.some((session) => session.status === "PLAYING"), false);

  const refreshedGames = JSON.parse(JSON.stringify(games)) as GameLifecycle[];
  const refreshedCheckIn = JSON.parse(JSON.stringify(closedCheckIn)) as CheckInDataState;
  assert.equal(getActiveGameForCourt(refreshedGames, "3x3-b"), undefined);
  assert.equal(refreshedCheckIn.games.length, 0);

  const historyBeforeDuplicate = [...result.history] as PlayerGameHistory[];
  const duplicate = processSubmittedGame(
    result.game,
    submission("black", "a", [7, 0, 0]),
    submission("air", "b", [2, 0, 0]),
    result.queue,
    historyBeforeDuplicate,
    result.decisions,
    "2026-08-06T01:12:00.000Z",
  );
  assert.deepEqual(duplicate, { ok: false, error: "ALREADY_FINALIZED" });
  assert.equal(historyBeforeDuplicate.length, 6);
});

test("a stale PLAYING queue seed does not block two checked-in teams", () => {
  const court = getCourtById("3x3-a");
  assert.ok(court);
  const readySessions: CheckInDataState = {
    version: 1,
    activeMockUserId: null,
    locations: {},
    games: [],
    sessions: ["north", "blue"].map((teamId) => ({
      id: `ready-${teamId}`,
      queueEntryId: `ready-entry-${teamId}`,
      courtId: "3x3-a" as const,
      teamId,
      teamName: teamId,
      members: members(teamId[0]),
      status: "READY_TO_PLAY" as const,
      calledAt: "2026-08-06T02:00:00.000Z",
      checkInDeadline: "2026-08-06T02:03:00.000Z",
      checkIns: [],
    })),
  };
  const staleQueue: QueueDataState = {
    version: 1,
    locationInRange: true,
    mockTeams: [],
    entries: [
      { id: "orphan", courtId: "3x3-a", teamId: "old-team", position: 0, status: "PLAYING", joinedAt: "2026-08-06T01:00:00.000Z" },
      { id: "ready-entry-north", courtId: "3x3-a", teamId: "north", position: 0, status: "READY_TO_PLAY", joinedAt: "2026-08-06T01:01:00.000Z" },
      { id: "ready-entry-blue", courtId: "3x3-a", teamId: "blue", position: 0, status: "READY_TO_PLAY", joinedAt: "2026-08-06T01:02:00.000Z" },
    ],
  };
  const started = startMockGame(staleQueue, readySessions, court, "2026-08-06T02:01:00.000Z");
  assert.equal(started.result.ok, true);
  assert.equal(started.queueState.entries.find((entry) => entry.id === "orphan")?.status, "WAITING");
  assert.equal(started.queueState.entries.filter((entry) => entry.status === "PLAYING").length, 2);
});

test("an orphan CHECKING_IN queue entry does not block calling the next team", () => {
  const queue: QueueDataState = {
    version: 1,
    locationInRange: true,
    mockTeams: [],
    entries: [
      { id: "orphan-checkin", courtId: "3x3-a", teamId: "old", position: 0, status: "CHECKING_IN", joinedAt: "2026-08-06T03:00:00.000Z" },
      { id: "next-entry", courtId: "3x3-a", teamId: "red", position: 1, status: "WAITING", joinedAt: "2026-08-06T03:01:00.000Z" },
    ],
  };
  const checkIn: CheckInDataState = { version: 1, activeMockUserId: null, locations: {}, sessions: [], games: [] };
  const team = { id: "red", name: "Red Fox", type: "THREE_X_THREE" as const, memberCount: 3, members: members("r") };
  const called = callNextTeam(queue, checkIn, "3x3-a", team, "2026-08-06T03:02:00.000Z");
  assert.equal(called.result.ok, true);
  assert.equal(called.result.session?.teamId, "red");
  assert.equal(called.queueState.entries.find((entry) => entry.id === "orphan-checkin")?.status, "WAITING");
});

test("a HOLDING_COURT winner starts the next game with one ready challenger", () => {
  const court = getCourtById("3x3-a");
  assert.ok(court);
  const holder = { id: "cr7", name: "CR7", type: "THREE_X_THREE" as const, memberCount: 3, members: members("c") };
  const challengerMembers = members("r");
  const queue: QueueDataState = {
    version: 1,
    locationInRange: true,
    mockTeams: [holder],
    entries: [
      { id: "holder-entry", courtId: "3x3-a", teamId: holder.id, position: 0, status: "HOLDING_COURT", joinedAt: "2026-08-06T04:00:00.000Z" },
      { id: "challenger-entry", courtId: "3x3-a", teamId: "red", position: 0, status: "READY_TO_PLAY", joinedAt: "2026-08-06T04:01:00.000Z" },
    ],
  };
  const checkIn: CheckInDataState = {
    version: 1,
    activeMockUserId: null,
    locations: {},
    games: [],
    sessions: [{ id: "challenger-session", queueEntryId: "challenger-entry", courtId: "3x3-a", teamId: "red", teamName: "Red Fox", members: challengerMembers, status: "READY_TO_PLAY", calledAt: "2026-08-06T04:01:00.000Z", checkInDeadline: "2026-08-06T04:04:00.000Z", checkIns: [] }],
  };
  const started = startMockGame(queue, checkIn, court, "2026-08-06T04:02:00.000Z", holder);
  assert.equal(started.result.ok, true);
  assert.equal(started.result.game?.teamAName, "CR7");
  assert.equal(started.result.game?.teamBName, "Red Fox");
  assert.equal(started.queueState.entries.filter((entry) => entry.status === "PLAYING").length, 2);
});

test("a two-win champion rests one game, returns next, and restarts its streak", () => {
  const court = getCourtById("3x3-b");
  assert.ok(court);
  const air = { id: "air", name: "Air Ball", type: "THREE_X_THREE" as const, memberCount: 3, members: members("a") };
  const black = { id: "black", name: "Black Cat", type: "THREE_X_THREE" as const, memberCount: 3, members: members("b") };
  const red = { id: "red", name: "Red Fox", type: "THREE_X_THREE" as const, memberCount: 3, members: members("r") };
  const secondWin: GameLifecycle = {
    id: "air-second-win", courtId: court.id,
    teamA: { teamId: air.id, teamName: air.name, captainUserId: "a0", members: air.members, consecutiveWinsBefore: 1 },
    teamB: { teamId: "cr7", teamName: "CR7", captainUserId: "c0", members: members("c"), consecutiveWinsBefore: 0 },
    targetScore: 7, startedAt: "2026-08-06T05:00:00.000Z", completedAt: "2026-08-06T05:10:00.000Z",
    status: "COMPLETED", isRestGame: false, winnerTeamId: air.id, loserTeamId: "cr7",
  };
  const queue: QueueDataState = { version: 1, locationInRange: true, mockTeams: [air, black, red], entries: [
    { id: "air-entry", courtId: court.id, teamId: air.id, position: 0, status: "PLAYING", joinedAt: "2026-08-06T04:00:00.000Z" },
    { id: "cr7-entry", courtId: court.id, teamId: "cr7", position: 0, status: "PLAYING", joinedAt: "2026-08-06T04:01:00.000Z" },
    { id: "black-entry", courtId: court.id, teamId: black.id, position: 1, status: "WAITING", joinedAt: "2026-08-06T04:02:00.000Z" },
    { id: "red-entry", courtId: court.id, teamId: red.id, position: 2, status: "WAITING", joinedAt: "2026-08-06T04:03:00.000Z" },
  ] };
  const afterSecondWin = processCompletedGame(secondWin, queue, "2026-08-06T05:10:00.000Z");
  assert.equal(afterSecondWin.game.postGame?.winnerConsecutiveWins, 2);
  assert.equal(afterSecondWin.queue.entries.find((entry) => entry.teamId === air.id)?.status, "RESTING");

  const restQueue: QueueDataState = { ...afterSecondWin.queue, entries: afterSecondWin.queue.entries.map((entry) => entry.teamId === black.id || entry.teamId === red.id ? { ...entry, status: "READY_TO_PLAY" as const, position: 0 } : entry) };
  const restCheckIn: CheckInDataState = { version: 1, activeMockUserId: null, locations: {}, games: [], sessions: [black, red].map((team) => ({ id: `${team.id}-session`, queueEntryId: `${team.id}-entry`, courtId: court.id, teamId: team.id, teamName: team.name, members: team.members, status: "READY_TO_PLAY" as const, calledAt: "2026-08-06T05:11:00.000Z", checkInDeadline: "2026-08-06T05:14:00.000Z", checkIns: [] })) };
  const restGameStarted = startMockGame(restQueue, restCheckIn, court, "2026-08-06T05:12:00.000Z");
  assert.equal(restGameStarted.result.ok, true);
  assert.equal(restGameStarted.result.game?.isRestGame, true);
  assert.equal(restGameStarted.result.game?.restingChampionTeamId, air.id);

  const restGame: GameLifecycle = {
    id: restGameStarted.result.game!.id, courtId: court.id,
    teamA: { teamId: black.id, teamName: black.name, captainUserId: "b0", members: black.members, consecutiveWinsBefore: 0 },
    teamB: { teamId: red.id, teamName: red.name, captainUserId: "r0", members: red.members, consecutiveWinsBefore: 0 },
    targetScore: 7, startedAt: "2026-08-06T05:12:00.000Z", completedAt: "2026-08-06T05:20:00.000Z",
    status: "COMPLETED", isRestGame: true, restingChampionTeamId: air.id, winnerTeamId: black.id, loserTeamId: red.id,
  };
  const afterRestGame = processCompletedGame(restGame, restGameStarted.queueState, "2026-08-06T05:20:00.000Z");
  assert.equal(afterRestGame.queue.entries.find((entry) => entry.teamId === air.id)?.status, "RETURNING_CHAMPION");
  const blackContinues = chooseWinnerContinuation(afterRestGame.game, afterRestGame.queue, "b0", true, "2026-08-06T05:21:00.000Z");
  assert.equal(blackContinues.error, undefined);
  const returnGame = startMockGame(blackContinues.queue!, { version: 1, activeMockUserId: null, locations: {}, sessions: [], games: [] }, court, "2026-08-06T05:22:00.000Z", black, air);
  assert.equal(returnGame.result.ok, true);
  assert.equal(returnGame.result.game?.teamAId, black.id);
  assert.equal(returnGame.result.game?.teamBId, air.id);
  assert.equal(returnGame.result.game?.teamBConsecutiveWinsBefore, 0);
  assert.equal(returnGame.result.game?.isRestGame, undefined);
});

test("legacy rest state repairs the returning champion and duplicate holder entries", () => {
  const court = getCourtById("3x3-b");
  assert.ok(court);
  const cr7 = { id: "cr7", name: "CR7", type: "THREE_X_THREE" as const, memberCount: 3, members: members("c") };
  const air = { id: "air", name: "Air Ball", type: "THREE_X_THREE" as const, memberCount: 3, members: members("a") };
  const completedRestGame: GameLifecycle = {
    id: "legacy-rest-game", courtId: court.id,
    teamA: { teamId: cr7.id, teamName: cr7.name, captainUserId: "c0", members: cr7.members, consecutiveWinsBefore: 0 },
    teamB: { teamId: "black", teamName: "Black Cat", captainUserId: "b0", members: members("b"), consecutiveWinsBefore: 0 },
    targetScore: 7, startedAt: "2026-08-06T06:00:00.000Z", completedAt: "2026-08-06T06:10:00.000Z",
    status: "COMPLETED", isRestGame: false, winnerTeamId: cr7.id, loserTeamId: "black",
    postGame: { winnerStatus: "HOLDING_COURT", winnerConsecutiveWins: 1, winnerContinuationDecision: "CONTINUE", loserStatus: "DECIDING_REQUEUE", nextTeamIds: [] },
  };
  const legacyQueue: QueueDataState = { version: 1, locationInRange: true, mockTeams: [cr7, air], entries: [
    { id: "cr7-old", courtId: court.id, teamId: cr7.id, position: 0, status: "HOLDING_COURT", joinedAt: "2026-08-06T06:11:00.000Z" },
    { id: "cr7-duplicate", courtId: court.id, teamId: cr7.id, position: 0, status: "HOLDING_COURT", joinedAt: "2026-08-06T06:12:00.000Z" },
    { id: "air-resting", courtId: court.id, teamId: air.id, position: 0, status: "RESTING", joinedAt: "2026-08-06T05:00:00.000Z" },
    { id: "black-called", courtId: court.id, teamId: "black", position: 1, status: "CHECKING_IN", joinedAt: "2026-08-06T06:12:30.000Z" },
  ] };
  const repaired = synchronizeHoldingWinnerEntry([completedRestGame], legacyQueue, "2026-08-06T06:13:00.000Z");
  assert.equal(repaired.entries.filter((entry) => entry.teamId === cr7.id && entry.status === "HOLDING_COURT").length, 1);
  assert.equal(repaired.entries.find((entry) => entry.teamId === air.id)?.status, "RETURNING_CHAMPION");
  const staleCheckIn: CheckInDataState = { version: 1, activeMockUserId: null, locations: {}, games: [], sessions: [{ id: "black-session", queueEntryId: "black-called", courtId: court.id, teamId: "black", teamName: "Black Cat", members: members("b"), status: "CHECKING_IN", calledAt: "2026-08-06T06:12:30.000Z", checkInDeadline: "2026-08-06T06:15:30.000Z", checkIns: [] }] };
  const nextGame = startMockGame(repaired, staleCheckIn, court, "2026-08-06T06:14:00.000Z", cr7, air);
  assert.equal(nextGame.result.ok, true);
  assert.equal(nextGame.result.game?.teamAId, cr7.id);
  assert.equal(nextGame.result.game?.teamBId, air.id);
  assert.equal(nextGame.queueState.entries.find((entry) => entry.teamId === "black")?.status, "WAITING");
  assert.equal(nextGame.checkInState.sessions.some((session) => session.teamId === "black"), false);
});
