import type { CourtId, QueueDataState, QueueEntryStatus } from "./queue-types";

export interface QueueRepository {
  load(): QueueDataState;
  save(state: QueueDataState): void;
  reset(): QueueDataState;
}

export const QUEUE_STORAGE_KEY = "meq-queue-mvp-v1";

export function createInitialQueueData(): QueueDataState {
  return {
    version: 1,
    lastResetAt: new Date().toISOString(),
    locationInRange: true,
    mockTeams: [
      { id: "queue-team-north", name: "North Star", type: "THREE_X_THREE", memberCount: 3, members: [{ id: "north-1", displayName: "Neo", initials: "NE" }, { id: "north-2", displayName: "Mew", initials: "MW" }, { id: "north-3", displayName: "Pun", initials: "PN" }] },
      { id: "queue-team-blue", name: "Blue Wave", type: "THREE_X_THREE", memberCount: 3, members: [{ id: "blue-1", displayName: "Bank", initials: "BK" }, { id: "blue-2", displayName: "Kao", initials: "KA" }, { id: "blue-3", displayName: "Win", initials: "WN" }] },
      { id: "queue-team-black", name: "Black Cat", type: "THREE_X_THREE", memberCount: 3, members: [{ id: "black-1", displayName: "Beam", initials: "BM" }, { id: "black-2", displayName: "Pond", initials: "PD" }, { id: "black-3", displayName: "Tee", initials: "TE" }] },
      { id: "queue-team-air", name: "Air Ball", type: "THREE_X_THREE", memberCount: 3, members: [{ id: "air-1", displayName: "Art", initials: "AR" }, { id: "air-2", displayName: "Ice", initials: "IC" }, { id: "air-3", displayName: "Run", initials: "RN" }] },
      { id: "queue-team-engineering", name: "Engineering", type: "FIVE_X_FIVE", memberCount: 5, members: [{ id: "eng-1", displayName: "Aon", initials: "AO" }, { id: "eng-2", displayName: "Best", initials: "BE" }, { id: "eng-3", displayName: "Champ", initials: "CH" }, { id: "eng-4", displayName: "Dome", initials: "DO" }, { id: "eng-5", displayName: "Earth", initials: "EA" }] },
      { id: "queue-team-alumni", name: "Alumni", type: "FIVE_X_FIVE", memberCount: 5, members: [{ id: "alumni-1", displayName: "First", initials: "FI" }, { id: "alumni-2", displayName: "Golf", initials: "GO" }, { id: "alumni-3", displayName: "Ham", initials: "HA" }, { id: "alumni-4", displayName: "James", initials: "JA" }, { id: "alumni-5", displayName: "Krit", initials: "KR" }] },
      { id: "queue-team-falcon", name: "Falcon", type: "THREE_X_THREE", memberCount: 3, members: [{ id: "falcon-1", displayName: "Film", initials: "FM" }, { id: "falcon-2", displayName: "Gun", initials: "GN" }, { id: "falcon-3", displayName: "Home", initials: "HM" }] },
      { id: "queue-team-redfox", name: "Red Fox", type: "THREE_X_THREE", memberCount: 3, members: [{ id: "fox-1", displayName: "Jay", initials: "JY" }, { id: "fox-2", displayName: "Kim", initials: "KM" }, { id: "fox-3", displayName: "Leo", initials: "LE" }] },
    ],
    entries: [
      { id: "entry-3a-playing-1", courtId: "3x3-a", teamId: "queue-team-falcon", position: 1, status: "WAITING", joinedAt: "2026-08-05T07:40:00.000Z" },
      { id: "entry-3a-playing-2", courtId: "3x3-a", teamId: "queue-team-redfox", position: 2, status: "WAITING", joinedAt: "2026-08-05T07:41:00.000Z" },
      { id: "entry-3a-1", courtId: "3x3-a", teamId: "queue-team-north", position: 3, status: "WAITING", joinedAt: "2026-08-05T08:00:00.000Z" },
      { id: "entry-3a-2", courtId: "3x3-a", teamId: "queue-team-blue", position: 4, status: "WAITING", joinedAt: "2026-08-05T08:05:00.000Z" },
      { id: "entry-3b-1", courtId: "3x3-b", teamId: "queue-team-black", position: 1, status: "WAITING", joinedAt: "2026-08-05T08:02:00.000Z" },
      { id: "entry-3b-2", courtId: "3x3-b", teamId: "queue-team-air", position: 2, status: "WAITING", joinedAt: "2026-08-05T08:08:00.000Z" },
      { id: "entry-5-1", courtId: "5x5", teamId: "queue-team-engineering", position: 0, status: "AWAITING_SCORE", joinedAt: "2026-08-05T07:30:00.000Z" },
      { id: "entry-5-2", courtId: "5x5", teamId: "queue-team-alumni", position: 1, status: "WAITING", joinedAt: "2026-08-05T08:12:00.000Z" },
    ],
  };
}

function isQueueDataState(value: unknown): value is QueueDataState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QueueDataState>;
  if (candidate.version !== 1 || !Array.isArray(candidate.entries) || !Array.isArray(candidate.mockTeams) || typeof candidate.locationInRange !== "boolean") return false;
  const courtIds = new Set<CourtId>(["3x3-a", "3x3-b", "5x5"]);
  const statuses = new Set<QueueEntryStatus>(["WAITING", "CALLED", "CHECKING_IN", "READY_TO_PLAY", "PLAYING", "DECIDING_CONTINUE", "HOLDING_COURT", "DECIDING_REQUEUE", "MISSED_QUEUE", "CANCELLED", "AWAITING_SCORE", "RESTING", "RETURNING_CHAMPION", "LEFT_QUEUE"]);
  const activeTeamIds = new Set<string>();
  const entriesAreValid = candidate.entries.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.teamId !== "string" || typeof item.joinedAt !== "string" || typeof item.position !== "number") return false;
    if (!courtIds.has(item.courtId as CourtId) || !statuses.has(item.status as QueueEntryStatus) || activeTeamIds.has(item.teamId)) return false;
    activeTeamIds.add(item.teamId);
    return true;
  });
  const teamsAreValid = candidate.mockTeams.every((team) => {
    if (!team || typeof team !== "object") return false;
    const item = team as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.name === "string" && (item.type === "THREE_X_THREE" || item.type === "FIVE_X_FIVE") && typeof item.memberCount === "number" && Array.isArray(item.members);
  });
  return entriesAreValid && teamsAreValid;
}

export class LocalStorageQueueRepository implements QueueRepository {
  load(): QueueDataState {
    try {
      const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) return this.reset();
      const parsed: unknown = JSON.parse(raw);
      if (!isQueueDataState(parsed)) return this.reset();
      return parsed;
    } catch {
      return this.reset();
    }
  }

  save(state: QueueDataState): void {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
  }

  reset(): QueueDataState {
    const initialState = createInitialQueueData();
    this.save(initialState);
    return initialState;
  }
}
