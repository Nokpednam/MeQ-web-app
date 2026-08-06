"use client";

import Image from "next/image";
import Link from "next/link";
import { useMeqLanguage } from "@/components/use-meq-language";
import { useQueueData } from "@/components/queue-provider";
import { courts } from "@/lib/court-data";
import { queueTranslations } from "@/lib/dashboard-translations";
import { useGameLifecycle } from "@/components/game-lifecycle-provider";
import { getActiveGameForCourt } from "@/lib/game-lifecycle-rules";

export default function CourtsPage() {
  const { language } = useMeqLanguage();
  const copy = queueTranslations[language];
  const { ready, state } = useQueueData();
  const { games } = useGameLifecycle();

  if (!ready || !state) return <div className="team-loading" role="status">{copy.loading}</div>;

  return <div className="court-page">
    <header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{copy.courtsTitle}</h1><p>{copy.courtsIntro}</p></div><Link className="back-link" href="/">← {copy.backDashboard}</Link></header>
    <div className="court-selection-grid">
      {courts.map((court) => {
        const activeGame = getActiveGameForCourt(games, court.id);
        const queueCount = state.entries.filter((entry) => entry.courtId === court.id && entry.status !== "PLAYING" && entry.status !== "AWAITING_SCORE").length;
        return <article className="selection-card" key={court.id}>
          <div className="selection-image"><Image src={court.image} alt={court.name} fill sizes="(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw" /><span className={`court-open-badge ${court.isOpen ? "is-open" : "is-closed"}`}>{court.isOpen ? copy.open : copy.closed}</span><strong>{court.name}</strong></div>
          <div className="selection-body"><div className="selection-title"><div><small>{court.type === "THREE_X_THREE" ? "3x3" : "5x5"}</small><h2>{court.name}</h2></div><span><small>{copy.targetScore}</small><b>{court.targetScore}</b></span></div>
          <div className="selection-game"><small>{activeGame?.status === "AWAITING_SCORE" ? copy.awaitingScore : copy.nowPlaying}</small><strong>{activeGame ? <>{activeGame.teamA.teamName} <b>VS</b> {activeGame.teamB.teamName}</> : copy.noCurrentGame}</strong></div>
          <div className="selection-footer"><span><b>{queueCount}</b> {copy.queueCount}</span><Link className="queue-primary-button" href={`/courts/${court.id}`}>{copy.viewDetails} →</Link></div></div>
        </article>;
      })}
    </div>
  </div>;
}
