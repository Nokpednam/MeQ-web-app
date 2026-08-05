"use client";

import Link from "next/link";
import { useTeamData } from "@/components/team-provider";
import { useMeqLanguage } from "@/components/use-meq-language";
import { teamTranslations } from "@/lib/dashboard-translations";
import { getTeamCapacity, getTeamStatus } from "@/lib/team-rules";

export default function TeamsPage() {
  const { language } = useMeqLanguage();
  const copy = teamTranslations[language];
  const { ready, currentTeam } = useTeamData();

  if (!ready) return <div className="team-loading" role="status">{copy.loading}</div>;

  return (
    <div className="team-page">
      <header className="team-page-heading">
        <div><p className="section-label">{copy.pageLabel}</p><h1>{copy.myTeam}</h1></div>
        <Link className="back-link" href="/">← {copy.backDashboard}</Link>
      </header>

      {!currentTeam ? (
        <section className="team-empty-state">
          <div className="empty-court-mark" aria-hidden="true"><span /></div>
          <p className="section-label">3x3 / 5x5</p>
          <h2>{copy.noTeamTitle}</h2>
          <p>{copy.noTeamDescription}</p>
          <Link className="team-primary-button" href="/teams/create">{copy.createTeam}<b>→</b></Link>
        </section>
      ) : (
        <section className="my-team-card">
          <div className="team-card-accent"><span>{currentTeam.type === "THREE_X_THREE" ? "3x3" : "5x5"}</span></div>
          <div className="my-team-copy">
            <div className="team-card-title"><div><p className="section-label">{copy.myTeam}</p><h2>{currentTeam.name}</h2></div><span className={`team-status status-${getTeamStatus(currentTeam).toLowerCase()}`}>{getTeamStatus(currentTeam) === "READY" ? copy.ready : copy.incomplete}</span></div>
            <dl className="team-summary-list">
              <div><dt>{copy.teamType}</dt><dd>{currentTeam.type === "THREE_X_THREE" ? "3x3" : "5x5"}</dd></div>
              <div><dt>{copy.members}</dt><dd>{currentTeam.members.length}/{getTeamCapacity(currentTeam.type)}</dd></div>
              <div><dt>{copy.status}</dt><dd>{getTeamStatus(currentTeam)}</dd></div>
            </dl>
            <Link className="team-primary-button" href={`/teams/${currentTeam.id}`}>{copy.manageTeam}<b>→</b></Link>
          </div>
        </section>
      )}
    </div>
  );
}
