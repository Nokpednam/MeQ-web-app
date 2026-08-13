import type { CourtId } from "./queue-types";
export type NotificationKind = "TEAM_CALLED" | "ONE_MINUTE_LEFT" | "TEAM_READY" | "MISSED_QUEUE" | "GAME_READY" | "RESULT_SAVED" | "WINNER_STAYS" | "WINNER_RESTS" | "CHAMPION_RETURNING" | "REQUEUE_DECISION" | "REQUEUE_ONE_MINUTE" | "REQUEUE_TIMEOUT" | "REQUEUE_SUCCESS";
export type MockNotification = { id: string; kind: NotificationKind; courtId: CourtId; teamId?: string; createdAt: string };
export type NotificationDataState = { version: 1; items: MockNotification[] };
