import type { CheckInDataState } from "./check-in-types";

export interface CheckInRepository { load(): CheckInDataState; save(state: CheckInDataState): void; reset(): CheckInDataState }
export const CHECK_IN_STORAGE_KEY = "meq-check-in-mvp-v1";

export function createInitialCheckInData(): CheckInDataState {
  return { version: 1, activeMockUserId: null, locations: {}, sessions: [], games: [] };
}

function isCheckInDataState(value: unknown): value is CheckInDataState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<CheckInDataState>;
  if (state.version !== 1 || !Array.isArray(state.sessions) || !Array.isArray(state.games) || !state.locations || typeof state.locations !== "object") return false;
  const validStatuses=new Set(["CALLED","CHECKING_IN","READY_TO_PLAY","MISSED_QUEUE","PLAYING"]);
  const sessionsValid=state.sessions.every((session)=>Boolean(session)&&typeof session.id==="string"&&typeof session.queueEntryId==="string"&&typeof session.teamId==="string"&&typeof session.teamName==="string"&&typeof session.calledAt==="string"&&typeof session.checkInDeadline==="string"&&validStatuses.has(session.status)&&Array.isArray(session.members)&&Array.isArray(session.checkIns)&&new Set(session.checkIns.map((item)=>item.userId)).size===session.checkIns.length);
  const gamesValid=state.games.every((game)=>Boolean(game)&&typeof game.id==="string"&&typeof game.teamAId==="string"&&typeof game.teamBId==="string"&&typeof game.targetScore==="number"&&typeof game.startedAt==="string"&&game.status==="PLAYING"&&Array.isArray(game.teamAMembers)&&Array.isArray(game.teamBMembers));
  return sessionsValid&&gamesValid;
}

export class LocalStorageCheckInRepository implements CheckInRepository {
  load(): CheckInDataState { try { const raw = window.localStorage.getItem(CHECK_IN_STORAGE_KEY); if (!raw) return this.reset(); const parsed: unknown = JSON.parse(raw); return isCheckInDataState(parsed) ? parsed : this.reset(); } catch { return this.reset(); } }
  save(state: CheckInDataState): void { window.localStorage.setItem(CHECK_IN_STORAGE_KEY, JSON.stringify(state)); }
  reset(): CheckInDataState { const state = createInitialCheckInData(); this.save(state); return state; }
}
