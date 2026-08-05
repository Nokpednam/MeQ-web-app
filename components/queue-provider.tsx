"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { courts, getCourtById } from "@/lib/court-data";
import { MockLocationChecker } from "@/lib/location-checker";
import { getActiveQueueEntryForTeam, isActiveQueueEntry, joinQueue as joinQueueRule, leaveQueue as leaveQueueRule } from "@/lib/queue-rules";
import { LocalStorageQueueRepository, type QueueRepository } from "@/lib/queue-repository";
import type { CourtId, QueueDataState, QueueMutationResult } from "@/lib/queue-types";
import { useTeamData } from "@/components/team-provider";

type QueueContextValue = {
  ready: boolean;
  state: QueueDataState | null;
  joinQueue(courtId: CourtId): QueueMutationResult;
  leaveQueue(): QueueMutationResult;
  setMockLocation(inRange: boolean): void;
  resetQueueData(): void;
  replaceQueueState(state: QueueDataState): void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children, repository }: { children: React.ReactNode; repository?: QueueRepository }) {
  const queueRepository = useMemo(() => repository ?? new LocalStorageQueueRepository(), [repository]);
  const [state, setState] = useState<QueueDataState | null>(null);
  const { currentTeam, currentUser, syncRosterLocks } = useTeamData();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setState(queueRepository.load()));
    return () => window.cancelAnimationFrame(frame);
  }, [queueRepository]);

  useEffect(() => {
    if (!state) return;
    syncRosterLocks(new Set(state.entries.filter(isActiveQueueEntry).map((entry) => entry.teamId)));
  }, [state, syncRosterLocks]);

  function commit(nextState: QueueDataState) {
    queueRepository.save(nextState);
    setState(nextState);
  }

  function joinQueue(courtId: CourtId): QueueMutationResult {
    if (!state || !currentTeam || !currentUser) return { ok: false, error: "TEAM_NOT_FOUND" };
    const court = getCourtById(courtId);
    if (!court) return { ok: false, error: "COURT_NOT_FOUND" };
    const locationChecker = new MockLocationChecker(state.locationInRange);
    const queueState = { ...state, locationInRange: locationChecker.isInRange() };
    const { state: nextState, result } = joinQueueRule(queueState, currentTeam, court, currentUser.id, new Date().toISOString());
    if (result.ok) commit(nextState);
    return result;
  }

  function leaveQueue(): QueueMutationResult {
    if (!state || !currentTeam || !currentUser) return { ok: false, error: "TEAM_NOT_FOUND" };
    const { state: nextState, result } = leaveQueueRule(state, currentTeam.id, currentUser.id, currentTeam.captainUserId);
    if (result.ok) commit(nextState);
    return result;
  }

  function setMockLocation(inRange: boolean) {
    if (!state) return;
    commit({ ...state, locationInRange: inRange });
  }

  function resetQueueData() {
    const resetState = queueRepository.reset();
    setState(resetState);
  }

  return <QueueContext.Provider value={{ ready: state !== null, state, joinQueue, leaveQueue, setMockLocation, resetQueueData, replaceQueueState: commit }}>{children}</QueueContext.Provider>;
}

export function useQueueData(): QueueContextValue {
  const context = useContext(QueueContext);
  if (!context) throw new Error("useQueueData must be used inside QueueProvider");
  return context;
}

export { courts, getActiveQueueEntryForTeam };
