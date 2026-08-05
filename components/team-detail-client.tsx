"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTeamData } from "@/components/team-provider";
import { useMeqLanguage } from "@/components/use-meq-language";
import { teamTranslations } from "@/lib/dashboard-translations";
import { getTeamErrorMessage } from "@/lib/team-error-copy";
import { canAddMember, getTeamCapacity, getTeamStatus } from "@/lib/team-rules";
import type { TeamRuleError } from "@/lib/team-types";

export function TeamDetailClient({ teamId }: { teamId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useMeqLanguage();
  const copy = teamTranslations[language];
  const { ready, state, currentUser, addMember, removeMember, transferCaptain, leaveTeam, dissolveTeam } = useTeamData();
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<TeamRuleError | null>(null);
  const team = state?.teams.find((item) => item.id === teamId) ?? null;
  const isCaptain = Boolean(team && currentUser && team.captainUserId === currentUser.id);
  const isCurrentMember = Boolean(team && currentUser && team.members.some((member) => member.userId === currentUser.id));
  const capacity = team ? getTeamCapacity(team.type) : 0;
  const isFull = Boolean(team && team.members.length >= capacity);
  const teamStatus = team ? getTeamStatus(team) : null;

  const searchableUsers = (() => {
    if (!state || !team) return [];
    const memberIds = new Set(team.members.map((member) => member.userId));
    return state.users
      .filter((user) => !memberIds.has(user.id))
      .filter((user) => user.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  })();

  if (!ready) return <div className="team-loading" role="status">{copy.loading}</div>;
  if (!team) return <section className="team-not-found"><h1>{copy.teamNotFound}</h1><Link className="team-primary-button" href="/teams">{copy.goToTeams}</Link></section>;

  function handleAdd(userId: string) {
    if (!team) return;
    const result = addMember(team.id, userId);
    setError(result.ok ? null : result.error);
  }

  function handleRemove(userId: string) {
    if (!team || !window.confirm(copy.confirmRemove)) return;
    const result = removeMember(team.id, userId);
    setError(result.ok ? null : result.error);
  }

  function handleTransfer(userId: string) {
    if (!team || !window.confirm(copy.confirmTransfer)) return;
    const result = transferCaptain(team.id, userId);
    setError(result.ok ? null : result.error);
  }

  function handleLeave() {
    if (!team || !window.confirm(copy.confirmLeave)) return;
    const result = leaveTeam(team.id);
    if (!result.ok) setError(result.error);
    else router.push("/teams");
  }

  function handleDissolve() {
    if (!team || !window.confirm(copy.confirmDissolve)) return;
    const result = dissolveTeam(team.id);
    if (!result.ok) setError(result.error);
    else router.push("/teams");
  }

  return (
    <div className="team-page team-detail-page">
      <header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{team.name}</h1><p>{copy.fixedType}</p></div><Link className="back-link" href="/teams">← {copy.myTeam}</Link></header>
      {searchParams.get("notice") === "already-member" ? <div className="team-notice" role="status">{copy.alreadyHasTeamNotice}</div> : null}
      {error ? <div className="team-error" role="alert">{getTeamErrorMessage(error, copy)}</div> : null}

      <section className="team-detail-hero">
        <div className="team-type-display"><small>{copy.teamType}</small><strong>{team.type === "THREE_X_THREE" ? "3x3" : "5x5"}</strong></div>
        <div><span className={`team-status status-${teamStatus?.toLowerCase()}`}>{teamStatus === "READY" ? copy.ready : copy.incomplete}</span><h2>{team.name}</h2><p>{copy.members} <strong>{team.members.length}/{capacity}</strong></p></div>
        <div className="roster-progress" aria-label={`${team.members.length}/${capacity}`}><span style={{ width: `${(team.members.length / capacity) * 100}%` }} /></div>
      </section>

      <div className="team-detail-grid">
        <section className="member-panel" aria-labelledby="member-heading">
          <div className="panel-heading"><div><p className="section-label">ROSTER</p><h2 id="member-heading">{copy.members}</h2></div>{isCaptain ? <button className="team-primary-button" type="button" disabled={isFull || team.rosterLocked} onClick={() => setShowAddMembers(true)}>{isFull ? copy.teamFull : `＋ ${copy.addMember}`}</button> : null}</div>
          <ul className="member-list">
            {team.members.map((member) => {
              const user = state?.users.find((item) => item.id === member.userId);
              if (!user) return null;
              const memberIsCaptain = member.role === "CAPTAIN";
              return (
                <li key={member.userId}>
                  <span className="member-avatar">{user.initials}</span>
                  <div className="member-identity"><strong>{user.displayName}{user.id === currentUser?.id ? <small> · {copy.currentUser}</small> : null}</strong><span>{memberIsCaptain ? copy.captain : copy.member}</span></div>
                  {memberIsCaptain ? <span className="captain-badge">★ {copy.captain}</span> : null}
                  {isCaptain && !memberIsCaptain ? <div className="member-actions"><button type="button" onClick={() => handleTransfer(user.id)}>{copy.transferCaptain}</button><button className="danger-text" type="button" onClick={() => handleRemove(user.id)}>{copy.remove}</button></div> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="team-control-panel">
          <p className="section-label">TEAM CONTROL</p>
          <h2>{copy.teamDetails}</h2>
          <dl><div><dt>{copy.teamType}</dt><dd>{team.type === "THREE_X_THREE" ? "3x3" : "5x5"}</dd></div><div><dt>{copy.status}</dt><dd><span className={`team-status status-${teamStatus?.toLowerCase()}`}>{teamStatus === "READY" ? copy.ready : copy.incomplete}</span></dd></div><div><dt>{copy.members}</dt><dd>{team.members.length}/{capacity}</dd></div></dl>
          <p className="editable-note">✓ {team.rosterLocked ? copy.rosterLocked : copy.rosterEditable}</p>
          {isCaptain ? <><p className="captain-leave-note">{copy.transferBeforeLeave}</p><button className="danger-button" type="button" onClick={handleDissolve}>{copy.dissolveTeam}</button></> : isCurrentMember ? <button className="team-secondary-button" type="button" onClick={handleLeave}>{copy.leaveTeam}</button> : null}
        </aside>
      </div>

      {showAddMembers ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddMembers(false); }}>
          <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-heading">
            <header><div><p className="section-label">ROSTER</p><h2 id="add-member-heading">{copy.addMember}</h2></div><button className="dialog-close" type="button" onClick={() => setShowAddMembers(false)} aria-label={copy.close}>×</button></header>
            <label className="search-field" htmlFor="member-search"><span>{copy.searchUsers}</span><input id="member-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoFocus /></label>
            {error ? <div className="team-error" role="alert">{getTeamErrorMessage(error, copy)}</div> : null}
            <div className="candidate-list" aria-label={copy.availableUsers}>
              {searchableUsers.length === 0 ? <p>{copy.noSearchResults}</p> : searchableUsers.map((user) => {
                const ruleError = canAddMember(team, user);
                const disabled = ruleError !== null;
                return <article key={user.id}><span className="member-avatar">{user.initials}</span><div><strong>{user.displayName}</strong><small>{user.currentTeamId ? copy.alreadyInOtherTeam : copy.availableUsers}</small></div><button type="button" disabled={disabled} onClick={() => handleAdd(user.id)}>{disabled ? copy.alreadyInOtherTeam : copy.add}</button></article>;
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
