"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { canAddMember, canLeaveTeam, canRemoveMember, canTransferCaptain, normalizeTeamName, validateTeamName } from "@/lib/team-rules";
import { LocalStorageTeamRepository, type TeamRepository } from "@/lib/team-repository";
import type { Team, TeamDataState, TeamMutationResult, TeamType, User } from "@/lib/team-types";

type TeamContextValue = {
  ready: boolean;
  state: TeamDataState | null;
  currentUser: User | null;
  currentTeam: Team | null;
  createTeam(name: string, type: TeamType): TeamMutationResult;
  addMember(teamId: string, userId: string): TeamMutationResult;
  removeMember(teamId: string, userId: string): TeamMutationResult;
  transferCaptain(teamId: string, userId: string): TeamMutationResult;
  leaveTeam(teamId: string): TeamMutationResult;
  dissolveTeam(teamId: string): TeamMutationResult;
  syncRosterLocks(activeTeamIds: Set<string>): void;
  resetMockData(): void;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children, repository }: { children: React.ReactNode; repository?: TeamRepository }) {
  const teamRepository = useMemo(() => repository ?? new LocalStorageTeamRepository(), [repository]);
  const [state, setState] = useState<TeamDataState | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setState(teamRepository.load()));
    return () => window.cancelAnimationFrame(frame);
  }, [teamRepository]);

  const commit = useCallback((nextState: TeamDataState) => {
    teamRepository.save(nextState);
    setState(nextState);
  }, [teamRepository]);

  const currentUser = state?.users.find((user) => user.id === state.currentUserId) ?? null;
  const currentTeam = currentUser?.currentTeamId ? state?.teams.find((team) => team.id === currentUser.currentTeamId) ?? null : null;

  function createTeam(name: string, type: TeamType): TeamMutationResult {
    if (!state || !currentUser) return { ok: false, error: "USER_NOT_FOUND" };
    const nameError = validateTeamName(name);
    if (nameError) return { ok: false, error: nameError };
    if (currentUser.currentTeamId) return { ok: false, error: "USER_ALREADY_IN_TEAM" };
    const teamId = `team-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const team: Team = {
      id: teamId,
      name: normalizeTeamName(name),
      type,
      captainUserId: currentUser.id,
      members: [{ userId: currentUser.id, role: "CAPTAIN", joinedAt: now }],
      rosterLocked: false,
      createdAt: now,
    };
    commit({
      ...state,
      teams: [...state.teams, team],
      users: state.users.map((user) => user.id === currentUser.id ? { ...user, currentTeamId: teamId } : user),
    });
    return { ok: true, teamId };
  }

  function addMember(teamId: string, userId: string): TeamMutationResult {
    if (!state || !currentUser) return { ok: false, error: "USER_NOT_FOUND" };
    const team = state.teams.find((item) => item.id === teamId);
    const user = state.users.find((item) => item.id === userId);
    if (!team) return { ok: false, error: "TEAM_NOT_FOUND" };
    if (!user) return { ok: false, error: "USER_NOT_FOUND" };
    if (team.captainUserId !== currentUser.id) return { ok: false, error: "CAPTAIN_ONLY" };
    const ruleError = canAddMember(team, user);
    if (ruleError) return { ok: false, error: ruleError };
    const joinedAt = new Date().toISOString();
    commit({
      ...state,
      teams: state.teams.map((item) => item.id === teamId ? { ...item, members: [...item.members, { userId, role: "MEMBER", joinedAt }] } : item),
      users: state.users.map((item) => item.id === userId ? { ...item, currentTeamId: teamId } : item),
    });
    return { ok: true, teamId };
  }

  function removeMember(teamId: string, userId: string): TeamMutationResult {
    if (!state || !currentUser) return { ok: false, error: "USER_NOT_FOUND" };
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) return { ok: false, error: "TEAM_NOT_FOUND" };
    const ruleError = canRemoveMember(team, currentUser.id, userId);
    if (ruleError) return { ok: false, error: ruleError };
    commit({
      ...state,
      teams: state.teams.map((item) => item.id === teamId ? { ...item, members: item.members.filter((member) => member.userId !== userId) } : item),
      users: state.users.map((item) => item.id === userId ? { ...item, currentTeamId: null } : item),
    });
    return { ok: true, teamId };
  }

  function transferCaptain(teamId: string, userId: string): TeamMutationResult {
    if (!state || !currentUser) return { ok: false, error: "USER_NOT_FOUND" };
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) return { ok: false, error: "TEAM_NOT_FOUND" };
    const ruleError = canTransferCaptain(team, currentUser.id, userId);
    if (ruleError) return { ok: false, error: ruleError };
    commit({
      ...state,
      teams: state.teams.map((item) => item.id === teamId ? {
        ...item,
        captainUserId: userId,
        members: item.members.map((member) => ({ ...member, role: member.userId === userId ? "CAPTAIN" : "MEMBER" })),
      } : item),
    });
    return { ok: true, teamId };
  }

  function leaveTeam(teamId: string): TeamMutationResult {
    if (!state || !currentUser) return { ok: false, error: "USER_NOT_FOUND" };
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) return { ok: false, error: "TEAM_NOT_FOUND" };
    const ruleError = canLeaveTeam(team, currentUser.id);
    if (ruleError) return { ok: false, error: ruleError };
    commit({
      ...state,
      teams: state.teams.map((item) => item.id === teamId ? { ...item, members: item.members.filter((member) => member.userId !== currentUser.id) } : item),
      users: state.users.map((item) => item.id === currentUser.id ? { ...item, currentTeamId: null } : item),
    });
    return { ok: true };
  }

  function dissolveTeam(teamId: string): TeamMutationResult {
    if (!state || !currentUser) return { ok: false, error: "USER_NOT_FOUND" };
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) return { ok: false, error: "TEAM_NOT_FOUND" };
    if (team.captainUserId !== currentUser.id) return { ok: false, error: "CAPTAIN_ONLY" };
    if (team.rosterLocked) return { ok: false, error: "ROSTER_LOCKED" };
    const memberIds = new Set(team.members.map((member) => member.userId));
    commit({
      ...state,
      teams: state.teams.filter((item) => item.id !== teamId),
      users: state.users.map((item) => memberIds.has(item.id) ? { ...item, currentTeamId: null } : item),
    });
    return { ok: true };
  }

  function resetMockData() {
    setState(teamRepository.reset());
  }

  const syncRosterLocks = useCallback((activeTeamIds: Set<string>) => {
    setState((currentState) => {
      if (!currentState) return currentState;
      let changed = false;
      const teams = currentState.teams.map((team) => {
        const rosterLocked = activeTeamIds.has(team.id);
        if (team.rosterLocked === rosterLocked) return team;
        changed = true;
        return { ...team, rosterLocked };
      });
      if (!changed) return currentState;
      const nextState = { ...currentState, teams };
      teamRepository.save(nextState);
      return nextState;
    });
  }, [teamRepository]);

  return (
    <TeamContext.Provider value={{ ready: state !== null, state, currentUser, currentTeam, createTeam, addMember, removeMember, transferCaptain, leaveTeam, dissolveTeam, syncRosterLocks, resetMockData }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamData(): TeamContextValue {
  const context = useContext(TeamContext);
  if (!context) throw new Error("useTeamData must be used inside TeamProvider");
  return context;
}
