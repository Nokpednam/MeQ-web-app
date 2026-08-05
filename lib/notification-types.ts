import type { CourtId } from "./queue-types";
export type NotificationKind = "TEAM_CALLED" | "ONE_MINUTE_LEFT" | "TEAM_READY" | "MISSED_QUEUE" | "GAME_READY";
export type MockNotification = { id: string; kind: NotificationKind; courtId: CourtId; teamId?: string; createdAt: string };
export type NotificationDataState = { version: 1; items: MockNotification[] };
