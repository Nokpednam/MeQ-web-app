"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useMeqLanguage } from "./use-meq-language";
import { teamTranslations } from "@/lib/dashboard-translations";
import { getTeamCapacity, getTeamStatus } from "@/lib/team-rules";
import type { TeamPageData } from "@/lib/supabase-team-repository";
import { addTeamMemberAction, createTeamAction, dissolveTeamAction, leaveTeamAction, removeTeamMemberAction, transferCaptainAction } from "@/app/teams/actions";

function TeamSubmitButton({ children, pendingText, className, disabled = false }: {
  children: ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={disabled || pending} aria-disabled={disabled || pending}>{pending ? pendingText : children}</button>;
}

function readableError(code: string | null, language: "th" | "en") {
  if (!code) return null;
  const th: Record<string, string> = { TEAM_NAME_LENGTH: "ชื่อทีมต้องมีความยาว 2–30 ตัวอักษร", USER_ALREADY_IN_TEAM: "ผู้ใช้นี้อยู่ในทีมอื่นแล้ว", TEAM_FULL: "สมาชิกทีมครบแล้ว", ROSTER_LOCKED: "ต้องออกจากคิวก่อนจึงจะแก้สมาชิกได้", CAPTAIN_ONLY: "เฉพาะหัวหน้าทีมเท่านั้น", CAPTAIN_CANNOT_LEAVE: "กรุณามอบตำแหน่งหัวหน้าทีมก่อนออก", CAPTAIN_CANNOT_REMOVE_SELF: "หัวหน้าทีมลบตัวเองโดยตรงไม่ได้", USER_NOT_MEMBER: "ไม่พบสมาชิกในทีม", USER_NOT_FOUND: "ไม่พบผู้ใช้นี้" };
  const en: Record<string, string> = { TEAM_NAME_LENGTH: "Team name must be 2–30 characters", USER_ALREADY_IN_TEAM: "This user already belongs to a team", TEAM_FULL: "The roster is full", ROSTER_LOCKED: "Leave the queue before editing the roster", CAPTAIN_ONLY: "Only the captain can do this", CAPTAIN_CANNOT_LEAVE: "Transfer captain before leaving", CAPTAIN_CANNOT_REMOVE_SELF: "The captain cannot remove themselves", USER_NOT_MEMBER: "Team member not found", USER_NOT_FOUND: "User not found" };
  return (language === "th" ? th : en)[code] ?? (language === "th" ? "ทำรายการไม่สำเร็จ กรุณาลองใหม่" : "The action failed. Please try again.");
}

function readableNotice(code: string | null, language: "th" | "en") {
  if (!code) return null;
  const th: Record<string, string> = {
    created: "สร้างทีมเรียบร้อยแล้ว ตอนนี้คุณเป็นหัวหน้าทีม",
    "already-member": "คุณมีทีมอยู่แล้ว จึงพามายังทีมปัจจุบัน",
    "member-added": "เพิ่มสมาชิกเข้าทีมเรียบร้อยแล้ว",
    "member-removed": "นำสมาชิกออกจากทีมเรียบร้อยแล้ว",
    "captain-transferred": "มอบตำแหน่งหัวหน้าทีมเรียบร้อยแล้ว",
    "team-left": "ออกจากทีมเรียบร้อยแล้ว",
    "team-dissolved": "ยุบทีมเรียบร้อยแล้ว",
  };
  const en: Record<string, string> = {
    created: "The team was created. You are now its captain.",
    "already-member": "You already belong to a team, so we brought you here.",
    "member-added": "The member was added to the team.",
    "member-removed": "The member was removed from the team.",
    "captain-transferred": "Team captaincy was transferred.",
    "team-left": "You left the team.",
    "team-dissolved": "The team was dissolved.",
  };
  return (language === "th" ? th : en)[code] ?? null;
}

export function TeamHomeView({ data }: { data: TeamPageData }) {
  const { language } = useMeqLanguage(); const copy = teamTranslations[language]; const team = data.currentTeam; const search = useSearchParams(); const notice = readableNotice(search.get("notice"), language); const error = readableError(search.get("error"), language);
  return <div className="team-page"><header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{copy.myTeam}</h1></div><Link className="back-link" href="/">← {copy.backDashboard}</Link></header>
    {notice ? <div className="queue-success" role="status">{notice}</div> : null}{error ? <div className="team-error" role="alert">{error}</div> : null}
    {!team ? <section className="team-empty-state"><div className="empty-court-mark" aria-hidden="true"><span /></div><p className="section-label">3x3 / 5x5</p><h2>{copy.noTeamTitle}</h2><p>{copy.noTeamDescription}</p><Link className="team-primary-button" href="/teams/create">{copy.createTeam}<b>→</b></Link></section> : <section className="my-team-card"><div className="team-card-accent"><span>{team.type === "THREE_X_THREE" ? "3x3" : "5x5"}</span></div><div className="my-team-copy"><div className="team-card-title"><div><p className="section-label">{copy.myTeam}</p><h2>{team.name}</h2></div><span className={`team-status status-${getTeamStatus(team).toLowerCase()}`}>{getTeamStatus(team) === "READY" ? copy.ready : copy.incomplete}</span></div><dl className="team-summary-list"><div><dt>{copy.teamType}</dt><dd>{team.type === "THREE_X_THREE" ? "3x3" : "5x5"}</dd></div><div><dt>{copy.members}</dt><dd>{team.members.length}/{getTeamCapacity(team.type)}</dd></div><div><dt>{copy.status}</dt><dd>{getTeamStatus(team)}</dd></div></dl><Link className="team-primary-button" href={`/teams/${team.id}`}>{copy.manageTeam}<b>→</b></Link></div></section>}
  </div>;
}

export function CreateTeamView() {
  const { language } = useMeqLanguage(); const copy = teamTranslations[language]; const search = useSearchParams(); const [type, setType] = useState("THREE_X_THREE");
  const error = readableError(search.get("error"), language);
  return <div className="team-page team-form-page"><header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{copy.createTeamTitle}</h1><p>{copy.createTeamIntro}</p></div><Link className="back-link" href="/teams">← {copy.cancel}</Link></header>{error ? <div className="team-error" role="alert">{error}</div> : null}<form className="create-team-form" action={createTeamAction}><div className="form-section"><label htmlFor="team-name">{copy.teamName}</label><input id="team-name" name="name" required minLength={2} maxLength={30} placeholder={copy.teamNamePlaceholder} /></div><fieldset className="form-section team-type-fieldset"><legend>{copy.teamType}</legend><div className="team-type-options">{(["THREE_X_THREE", "FIVE_X_FIVE"] as const).map((value) => <label className={type === value ? "is-selected" : ""} key={value}><input type="radio" name="format" value={value} checked={type === value} onChange={() => setType(value)} /><strong>{value === "THREE_X_THREE" ? "3x3" : "5x5"}</strong><span>{copy.maxMembers} {value === "THREE_X_THREE" ? 3 : 5} {copy.people}</span></label>)}</div><p className="form-note">✓ {copy.captainFirst}</p></fieldset><div className="form-actions"><Link className="team-secondary-button" href="/teams">{copy.cancel}</Link><TeamSubmitButton className="team-primary-button" pendingText={language === "th" ? "กำลังสร้างทีม…" : "Creating team…"}>{copy.createSubmit}<b>→</b></TeamSubmitButton></div></form></div>;
}

export function TeamDetailView({ data }: { data: TeamPageData }) {
  const { language } = useMeqLanguage(); const copy = teamTranslations[language]; const search = useSearchParams(); const router = useRouter(); const [dialog, setDialog] = useState(false); const [query, setQuery] = useState(""); const team = data.currentTeam; const awaitingCreatedTeam = !team && search.get("notice") === "created";
  useEffect(() => { if (!awaitingCreatedTeam) return; const timer = window.setTimeout(() => router.refresh(), 700); return () => window.clearTimeout(timer); }, [awaitingCreatedTeam, router]);
  if (!team) return <section className="team-not-found"><h1>{awaitingCreatedTeam ? copy.loading : copy.teamNotFound}</h1>{awaitingCreatedTeam ? <p>{language === "th" ? "กำลังซิงก์ข้อมูลทีมกับ Supabase…" : "Syncing the new team with Supabase…"}</p> : <Link className="team-primary-button" href="/teams">{copy.goToTeams}</Link>}</section>;
  const captain = team.captainUserId === data.currentUser.id; const capacity = getTeamCapacity(team.type); const memberIds = new Set(team.members.map((member) => member.userId)); const candidates = data.users.filter((user) => !memberIds.has(user.id) && user.displayName.toLowerCase().includes(query.toLowerCase())); const error = readableError(search.get("error"), language); const notice = readableNotice(search.get("notice"), language);
  return <div className="team-page team-detail-page"><header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{team.name}</h1><p>{copy.fixedType}</p></div><Link className="back-link" href="/teams">← {copy.myTeam}</Link></header>{notice ? <div className="queue-success" role="status">{notice}</div> : null}{error ? <div className="team-error" role="alert">{error}</div> : null}{team.rosterLocked ? <div className="team-queue-notice"><strong>{copy.rosterLocked}</strong><Link href="/courts">{copy.backDashboard} →</Link></div> : null}
    <section className="team-detail-hero"><div className="team-type-display"><small>{copy.teamType}</small><strong>{team.type === "THREE_X_THREE" ? "3x3" : "5x5"}</strong></div><div><span className={`team-status status-${getTeamStatus(team).toLowerCase()}`}>{getTeamStatus(team) === "READY" ? copy.ready : copy.incomplete}</span><h2>{team.name}</h2><p>{copy.members} <strong>{team.members.length}/{capacity}</strong></p></div><div className="roster-progress"><span style={{ width: `${team.members.length / capacity * 100}%` }} /></div></section>
    <div className="team-detail-grid"><section className="member-panel"><div className="panel-heading"><div><p className="section-label">ROSTER</p><h2>{copy.members}</h2></div>{captain ? <button className="team-primary-button" disabled={team.members.length >= capacity || team.rosterLocked} onClick={() => setDialog(true)}>＋ {copy.addMember}</button> : null}</div><ul className="member-list">{team.members.map((member) => { const user = data.users.find((item) => item.id === member.userId); if (!user) return null; return <li key={user.id}><span className="member-avatar">{user.initials}</span><div className="member-identity"><strong>{user.displayName}{user.id === data.currentUser.id ? <small> · {copy.currentUser}</small> : null}</strong><span>{member.role === "CAPTAIN" ? copy.captain : copy.member}</span></div>{member.role === "CAPTAIN" ? <span className="captain-badge">★ {copy.captain}</span> : captain ? <div className="member-actions"><form action={transferCaptainAction} onSubmit={(e) => { if (!confirm(copy.confirmTransfer)) e.preventDefault(); }}><input type="hidden" name="teamId" value={team.id}/><input type="hidden" name="userId" value={user.id}/><TeamSubmitButton disabled={team.rosterLocked} pendingText={language === "th" ? "กำลังมอบ…" : "Transferring…"}>{copy.transferCaptain}</TeamSubmitButton></form><form action={removeTeamMemberAction} onSubmit={(e) => { if (!confirm(copy.confirmRemove)) e.preventDefault(); }}><input type="hidden" name="teamId" value={team.id}/><input type="hidden" name="userId" value={user.id}/><TeamSubmitButton className="danger-text" disabled={team.rosterLocked} pendingText={language === "th" ? "กำลังลบ…" : "Removing…"}>{copy.remove}</TeamSubmitButton></form></div> : null}</li>; })}</ul></section>
    <aside className="team-control-panel"><p className="section-label">TEAM CONTROL</p><h2>{copy.teamDetails}</h2><dl><div><dt>{copy.teamType}</dt><dd>{team.type === "THREE_X_THREE" ? "3x3" : "5x5"}</dd></div><div><dt>{copy.status}</dt><dd><span className={`team-status status-${getTeamStatus(team).toLowerCase()}`}>{getTeamStatus(team) === "READY" ? copy.ready : copy.incomplete}</span></dd></div><div><dt>{copy.members}</dt><dd>{team.members.length}/{capacity}</dd></div></dl>{captain ? <><p>{copy.transferBeforeLeave}</p><form action={dissolveTeamAction} onSubmit={(e) => { if (!confirm(copy.confirmDissolve)) e.preventDefault(); }}><input type="hidden" name="teamId" value={team.id}/><TeamSubmitButton className="danger-button" disabled={team.rosterLocked} pendingText={language === "th" ? "กำลังยุบทีม…" : "Dissolving team…"}>{copy.dissolveTeam}</TeamSubmitButton></form></> : <form action={leaveTeamAction} onSubmit={(e) => { if (!confirm(copy.confirmLeave)) e.preventDefault(); }}><input type="hidden" name="teamId" value={team.id}/><TeamSubmitButton className="team-secondary-button" disabled={team.rosterLocked} pendingText={language === "th" ? "กำลังออกจากทีม…" : "Leaving team…"}>{copy.leaveTeam}</TeamSubmitButton></form>}</aside></div>
    {dialog ? <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(false); }}><section className="member-dialog" role="dialog" aria-modal="true"><header><h2>{copy.addMember}</h2><button className="dialog-close" onClick={() => setDialog(false)}>×</button></header><label className="search-field"><span>{copy.searchUsers}</span><input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></label><div className="candidate-list">{candidates.length ? candidates.map((user) => <article key={user.id}><span className="member-avatar">{user.initials}</span><div><strong>{user.displayName}</strong><small>{user.currentTeamId ? copy.alreadyInOtherTeam : copy.availableUsers}</small></div><form action={addTeamMemberAction}><input type="hidden" name="teamId" value={team.id}/><input type="hidden" name="userId" value={user.id}/><TeamSubmitButton disabled={Boolean(user.currentTeamId)} pendingText={language === "th" ? "กำลังเพิ่ม…" : "Adding…"}>{user.currentTeamId ? copy.alreadyInOtherTeam : copy.add}</TeamSubmitButton></form></article>) : <p>{copy.noSearchResults}</p>}</div></section></div> : null}
  </div>;
}
