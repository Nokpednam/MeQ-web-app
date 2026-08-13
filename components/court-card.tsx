import Image from "next/image";
import Link from "next/link";
import type { DashboardCopy } from "@/lib/dashboard-translations";
import type { CourtView } from "@/lib/mock-data";
import type { GameLifecycle } from "@/lib/game-lifecycle-types";

export function CourtCard({ court, copy, activeGame, queueCount }: { court: CourtView; copy: DashboardCopy; activeGame?: GameLifecycle; queueCount: number }) {
  const statusText = { OPEN: copy.open, BUSY: copy.busy, CLOSED: copy.closed };
  const visualStatus = activeGame ? "BUSY" : court.status === "CLOSED" ? "CLOSED" : "OPEN";
  return (
    <article className="court-card">
      <div className="court-image-wrap">
        <Image className="court-image" src={court.image} alt={`${copy.basketballCourt} ${court.name}`} fill loading={court.id === "3x3-a" ? "eager" : "lazy"} sizes="(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw" />
        <span className={`court-status status-${visualStatus.toLowerCase()}`}><i />{statusText[visualStatus]}</span>
        <span className="court-number">{court.name}</span>
      </div>
      <div className="court-body">
        <div className="court-heading"><div><p className="section-label">{copy.basketballCourt}</p><h3>{court.name}</h3></div><div className="target-score"><span>{copy.target}</span><strong>{court.targetScore}</strong></div></div>
        <div className="court-match">
          <span>{activeGame?.status === "AWAITING_SCORE" ? copy.awaitingScore : copy.nowPlaying}</span>
          {activeGame ? <strong>{activeGame.teamA.teamName} <b className="match-versus">VS</b> {activeGame.teamB.teamName}</strong> : <strong className="muted-match">{copy.noMatch}</strong>}
        </div>
        <div className="court-footer"><span><b>{queueCount}</b> {copy.teamsInQueue}</span><Link href={`/courts/${court.id}`}>{copy.viewDetails}<b>→</b></Link></div>
      </div>
    </article>
  );
}
