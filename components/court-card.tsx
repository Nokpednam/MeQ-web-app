import Image from "next/image";
import type { DashboardCopy } from "@/lib/dashboard-translations";
import type { CourtView } from "@/lib/mock-data";

export function CourtCard({ court, copy }: { court: CourtView; copy: DashboardCopy }) {
  const statusText = { OPEN: copy.open, BUSY: copy.busy, CLOSED: copy.closed };
  return (
    <article className="court-card">
      <div className="court-image-wrap">
        <Image className="court-image" src={court.image} alt={`${copy.basketballCourt} ${court.name}`} fill loading={court.id === "3x3-a" ? "eager" : "lazy"} sizes="(max-width: 599px) 100vw, (max-width: 899px) 50vw, 33vw" />
        <span className={`court-status status-${court.status.toLowerCase()}`}><i />{statusText[court.status]}</span>
        <span className="court-number">{court.name}</span>
      </div>
      <div className="court-body">
        <div className="court-heading"><div><p className="section-label">{copy.basketballCourt}</p><h3>{court.name}</h3></div><div className="target-score"><span>{copy.target}</span><strong>{court.targetScore}</strong></div></div>
        <div className="court-match">
          <span>{court.awaitingScore ? copy.awaitingScore : copy.nowPlaying}</span>
          {court.playing ? <strong>{court.playing.home} <b className="match-versus">VS</b> {court.playing.away}</strong> : court.awaitingScore ? <strong>{court.awaitingScore.home} <b className="match-versus">VS</b> {court.awaitingScore.away}</strong> : <strong className="muted-match">{copy.noMatch}</strong>}
        </div>
        <div className="court-footer"><span><b>{court.queue.length}</b> {copy.teamsInQueue}</span><button type="button">{copy.viewDetails}<b>→</b></button></div>
      </div>
    </article>
  );
}
