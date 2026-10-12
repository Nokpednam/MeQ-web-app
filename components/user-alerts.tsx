"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { gameStatusLabel } from "@/lib/game-status-copy";
import type { UserAlerts as UserAlertsData } from "@/lib/supabase-user-alerts-repository";

const scoreStatuses = ["END_REQUESTED", "AWAITING_SCORE", "INVALID_SCORE"];

/** App-wide banners for an unfinished game and team invitations, plus a score prompt for team leaders. */
export function UserAlerts({ alerts }: { alerts: UserAlertsData }) {
  const pathname = usePathname();
  const [dismissedPrompt, setDismissedPrompt] = useState<string | null>(null);
  const game = alerts.activeGame;
  const gamePath = game ? `/games/${game.id}` : null;
  const scoresPath = game ? `/games/${game.id}/scores` : null;
  const promptKey = game ? `${game.id}:${game.status}` : null;
  const showScorePrompt = Boolean(game && game.isLeader && scoreStatuses.includes(game.status)
    && !game.myTeamSubmitted && pathname !== scoresPath && dismissedPrompt !== promptKey);
  const showGameBanner = Boolean(game && gamePath && !pathname.startsWith(gamePath));
  const showInvitations = alerts.pendingInvitations > 0 && !pathname.startsWith("/teams");
  if (!showScorePrompt && !showGameBanner && !showInvitations) return null;

  return <>
    {showGameBanner || showInvitations ? <div className="user-alerts" role="status">
      {showGameBanner && game ? <Link href={gamePath!}><span>ทีมคุณมีเกมที่สนาม {game.courtId.toUpperCase()} · {gameStatusLabel(game.status)}</span><b>ไปหน้าเกม →</b></Link> : null}
      {showInvitations ? <Link href="/teams"><span>มีคำเชิญเข้าทีม {alerts.pendingInvitations} รายการ</span><b>ดูคำเชิญ →</b></Link> : null}
    </div> : null}
    {showScorePrompt && game ? <div className="score-prompt-backdrop">
      <div className="score-prompt" role="dialog" aria-modal="true" aria-labelledby="score-prompt-title">
        <h2 id="score-prompt-title">{game.status === "INVALID_SCORE" ? "คะแนนไม่ผ่าน ต้องส่งใหม่" : "ขอจบเกมแล้ว ส่งคะแนนทีมคุณ"}</h2>
        <p>สนาม {game.courtId.toUpperCase()} · ส่งคะแนนรายคนให้ทันเวลา ถ้าไม่ทัน เกมนี้จะไม่มีผล</p>
        <div>
          <Link className="queue-primary-button" href={scoresPath!}>ไปใส่คะแนน</Link>
          <button type="button" onClick={() => setDismissedPrompt(promptKey)}>ไว้ทีหลัง</button>
        </div>
      </div>
    </div> : null}
  </>;
}
