"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useMeqLanguage } from "@/components/use-meq-language";
import { useQueueData } from "@/components/queue-provider";
import { useTeamData } from "@/components/team-provider";
import { getCourtById } from "@/lib/court-data";
import { queueTranslations } from "@/lib/dashboard-translations";
import { getQueueErrorMessage } from "@/lib/queue-error-copy";
import { canTeamJoinCourt, getActiveQueueEntryForTeam, isTeamCompatibleWithCourt } from "@/lib/queue-rules";
import { getTeamStatus } from "@/lib/team-rules";
import type { QueueEntryStatus, QueueRuleError } from "@/lib/queue-types";
import { CheckInPanel } from "@/components/check-in-panel";

const statusKeys: Record<QueueEntryStatus, "waiting" | "called" | "readyToPlay" | "playing" | "awaitingScore" | "resting"> = {
  WAITING: "waiting", CALLED: "called", CHECKING_IN: "called", READY_TO_PLAY: "readyToPlay", PLAYING: "playing", MISSED_QUEUE: "waiting", CANCELLED: "waiting", AWAITING_SCORE: "awaitingScore", RESTING: "resting",
};

export function CourtDetailClient({ courtId }: { courtId: string }) {
  const { language } = useMeqLanguage();
  const copy = queueTranslations[language];
  const { ready, state, joinQueue, leaveQueue, setMockLocation } = useQueueData();
  const { state: teamState, currentTeam, currentUser } = useTeamData();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<QueueRuleError | null>(null);
  const court = getCourtById(courtId);

  if (!ready || !state) return <div className="team-loading" role="status">{copy.loading}</div>;
  if (!court) return <section className="team-not-found"><h1>{copy.courtNotFound}</h1><Link className="queue-primary-button" href="/courts">{copy.courtsTitle}</Link></section>;
  const queueState = state;
  const selectedCourt = court;

  const activeEntry = currentTeam ? getActiveQueueEntryForTeam(queueState.entries, currentTeam.id) : null;
  const entryOnThisCourt = activeEntry?.courtId === selectedCourt.id ? activeEntry : null;
  const isCaptain = Boolean(currentTeam && currentUser && currentTeam.captainUserId === currentUser.id);
  const queueEntries = queueState.entries.filter((entry) => entry.courtId === selectedCourt.id && entry.status === "WAITING").sort((a, b) => a.position - b.position || a.joinedAt.localeCompare(b.joinedAt));
  const joinError = canTeamJoinCourt({ team: currentTeam, court: selectedCourt, entries: queueState.entries, actorUserId: currentUser?.id ?? "", locationInRange: queueState.locationInRange });

  function resolveTeam(entryTeamId: string) {
    const localTeam = teamState?.teams.find((team) => team.id === entryTeamId);
    if (localTeam) return { name: localTeam.name, memberCount: localTeam.members.length, status: getTeamStatus(localTeam) };
    const mockTeam = queueState.mockTeams.find((team) => team.id === entryTeamId);
    if (mockTeam) return { name: mockTeam.name, memberCount: mockTeam.memberCount, status: "READY" as const };
    return { name: "Unknown team", memberCount: 0, status: "INCOMPLETE" as const };
  }

  function handleJoin() {
    const result = joinQueue(selectedCourt.id);
    if (!result.ok) { setError(result.error); setMessage(null); return; }
    setError(null);
    setMessage(`${copy.joinedSuccess} ${result.entry?.position ?? "-"}`);
  }

  function handleLeave() {
    if (!window.confirm(copy.confirmLeaveQueue)) return;
    const result = leaveQueue();
    if (!result.ok) { setError(result.error); setMessage(null); return; }
    setError(null);
    setMessage(copy.leftSuccess);
  }

  function actionContent() {
    if (!currentTeam) return <><p>{copy.createTeam}</p><Link className="queue-primary-button" href="/teams/create">{copy.createTeam}</Link></>;
    if (activeEntry && !entryOnThisCourt) return <><p>{copy.activeOtherCourt}</p><Link className="queue-secondary-button" href={`/courts/${activeEntry.courtId}`}>{copy.goToCurrentQueue}</Link></>;
    if (entryOnThisCourt) {
      const canLeave = isCaptain && entryOnThisCourt.status === "WAITING";
      return <><p>{copy.alreadyInQueue} · {copy.position} {entryOnThisCourt.position}</p>{canLeave ? <button className="queue-danger-button" type="button" onClick={handleLeave}>{copy.leaveQueue}</button> : <small>{isCaptain ? copy.cannotLeaveActive : copy.captainOnly}</small>}</>;
    }
    if (currentTeam && getTeamStatus(currentTeam) !== "READY") return <><p>{copy.teamIncomplete}</p><Link className="queue-secondary-button" href={`/teams/${currentTeam.id}`}>{copy.manageTeam}</Link></>;
    if (currentTeam && !isTeamCompatibleWithCourt(currentTeam, selectedCourt)) return <p>{copy.incompatibleCourt}</p>;
    if (!isCaptain) return <p>{copy.captainOnly}</p>;
    return <><p>{joinError ? getQueueErrorMessage(joinError, copy) : copy.joinQueue}</p><button className="queue-primary-button" type="button" disabled={joinError !== null} onClick={handleJoin}>{copy.joinQueue}</button></>;
  }

  return <div className="court-page court-detail-page">
    <header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{selectedCourt.name}</h1><p>{copy.courtDetails}</p></div><Link className="back-link" href="/courts">← {copy.courtsTitle}</Link></header>
    <section className="court-detail-hero"><div className="court-detail-image"><Image src={selectedCourt.image} alt={selectedCourt.name} fill sizes="(max-width: 699px) 100vw, 48vw" priority /></div><div className="court-detail-summary"><span className={`court-open-badge ${selectedCourt.isOpen ? "is-open" : "is-closed"}`}>{selectedCourt.isOpen ? copy.open : copy.closed}</span><h2>{selectedCourt.name}</h2><dl><div><dt>{copy.operatingHours}</dt><dd>{selectedCourt.opensAt}–{selectedCourt.closesAt}</dd></div><div><dt>{copy.targetScore}</dt><dd>{selectedCourt.targetScore} {copy.points}</dd></div><div><dt>{copy.requiredRoster}</dt><dd>{selectedCourt.requiredMembers} {copy.people}</dd></div></dl><div className="current-match"><small>{selectedCourt.currentGame?.status === "AWAITING_SCORE" ? copy.awaitingScore : copy.nowPlaying}</small><strong>{selectedCourt.currentGame ? <>{selectedCourt.currentGame.home} <b>VS</b> {selectedCourt.currentGame.away}</> : copy.noCurrentGame}</strong></div></div></section>
    <section className="location-simulator"><div><span>DEV</span><div><strong>{copy.mockLocation}</strong><small>{copy.mockLocationHint}</small></div></div><div className="location-options" role="group" aria-label={copy.mockLocation}><button className={queueState.locationInRange ? "is-active" : ""} type="button" onClick={() => setMockLocation(true)}>● {copy.inRange}</button><button className={!queueState.locationInRange ? "is-active is-out" : ""} type="button" onClick={() => setMockLocation(false)}>● {copy.outOfRangeOption}</button></div></section>
    {message ? <div className="queue-success" role="status">{message}</div> : null}{error ? <div className="team-error" role="alert">{getQueueErrorMessage(error, copy)}</div> : null}
    <CheckInPanel courtId={selectedCourt.id} />
    <div className="court-queue-grid"><section className="queue-panel"><div className="panel-heading"><div><p className="section-label">QUEUE / {String(queueEntries.length).padStart(2, "0")}</p><h2>{copy.queueTitle}</h2><p>{copy.queueHint}</p></div></div>{queueEntries.length === 0 ? <p className="empty-queue">{copy.noQueue}</p> : <ol className="court-queue-list">{queueEntries.map((entry) => { const team = resolveTeam(entry.teamId); const isYours = currentTeam?.id === entry.teamId; return <li className={isYours ? "is-yours" : ""} key={entry.id}><span className="queue-position">{entry.position}</span><div><strong>{team.name}{isYours ? <small> · {copy.yourTeam}</small> : null}</strong><span>{copy.members} {team.memberCount}/{selectedCourt.requiredMembers}</span></div><span className={`queue-state state-${entry.status.toLowerCase()}`}>{copy[statusKeys[entry.status]]}</span><span className={`team-status status-${team.status.toLowerCase()}`}>{team.status}</span></li>; })}</ol>}</section>
    <aside className="queue-action-panel"><p className="section-label">YOUR TEAM</p><h2>{currentTeam?.name ?? copy.createTeam}</h2>{actionContent()}</aside></div>
  </div>;
}
