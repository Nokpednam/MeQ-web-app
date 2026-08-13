import type { TeamDataState } from "./team-types";

export interface TeamRepository {
  load(): TeamDataState;
  save(state: TeamDataState): void;
  reset(): TeamDataState;
}

export const TEAM_STORAGE_KEY = "meq-team-mvp-v1";

export function createInitialTeamData(): TeamDataState {
  return {
    currentUserId: "user-punn",
    users: [
      { id: "user-punn", displayName: "ปุณณ์", initials: "ปณ", currentTeamId: null },
      { id: "user-01", displayName: "มินท์", initials: "มท", currentTeamId: null },
      { id: "user-02", displayName: "ภูมิ", initials: "ภม", currentTeamId: null },
      { id: "user-03", displayName: "เจเจ", initials: "JJ", currentTeamId: null },
      { id: "user-04", displayName: "ฟ้า", initials: "ฟ", currentTeamId: null },
      { id: "user-05", displayName: "นนท์", initials: "นน", currentTeamId: null },
      { id: "user-06", displayName: "ต้น", initials: "ต", currentTeamId: null },
      { id: "user-07", displayName: "แพรว", initials: "พร", currentTeamId: null },
      { id: "user-08", displayName: "บอส", initials: "BS", currentTeamId: "team-campus" },
      { id: "user-09", displayName: "ไอซ์", initials: "IC", currentTeamId: "team-campus" },
    ],
    teams: [
      {
        id: "team-campus",
        name: "Campus Crew",
        type: "THREE_X_THREE",
        captainUserId: "user-08",
        members: [
          { userId: "user-08", role: "CAPTAIN", joinedAt: "2026-08-05T08:00:00.000Z" },
          { userId: "user-09", role: "MEMBER", joinedAt: "2026-08-05T08:05:00.000Z" },
        ],
        rosterLocked: false,
        createdAt: "2026-08-05T08:00:00.000Z",
      },
    ],
  };
}

function isTeamDataState(value: unknown): value is TeamDataState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TeamDataState>;
  return typeof candidate.currentUserId === "string" && Array.isArray(candidate.users) && Array.isArray(candidate.teams);
}

export class LocalStorageTeamRepository implements TeamRepository {
  load(): TeamDataState {
    try {
      const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
      if (!raw) return this.reset();
      const parsed: unknown = JSON.parse(raw);
      if (!isTeamDataState(parsed)) return this.reset();
      return parsed;
    } catch {
      return this.reset();
    }
  }

  save(state: TeamDataState): void {
    window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(state));
  }

  reset(): TeamDataState {
    const initialState = createInitialTeamData();
    this.save(initialState);
    return initialState;
  }
}
