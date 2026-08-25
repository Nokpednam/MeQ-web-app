"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { decideLoserRequeueAction, decideWinnerContinuationAction } from "@/app/games/actions";
import type { SupabaseGameResultData } from "@/lib/supabase-game-result-repository";

function DecisionTimer({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - (now || Date.parse(deadline) - 180_000)) / 1000));
  return <div className="decision-timer" role="timer"><small>เวลาตัดสินใจ</small><strong>{String(Math.floor(seconds / 60)).padStart(2,"0")}:{String(seconds % 60).padStart(2,"0")}</strong></div>;
}

export function SupabaseGameResult({ game }: { game: SupabaseGameResultData }) {
  const search = useSearchParams();
  const winner = game.winnerTeamId === game.teamA.id ? game.teamA : game.teamB;
  const error = search.get("error");
  const notice = search.get("notice");
  const loserDeciding = game.loserQueueStatus === "DECIDING_REQUEUE" && game.loserDecisionDeadline;
  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">FINAL RESULT / SUPABASE</p><h1>ผลการแข่งขัน</h1><p>สนาม {game.courtId.toUpperCase()} · เป้าหมาย {game.targetScore} แต้ม</p></div><Link href={`/courts/${game.courtId}`}>← กลับสนาม</Link></header>
    {notice ? <div className="queue-success" role="status">บันทึกการตัดสินใจเรียบร้อยแล้ว</div> : null}
    {error ? <div className="team-error" role="alert">ทำรายการไม่สำเร็จ: {error.replaceAll("_", " ")}</div> : null}
    <section className="final-result"><span>ทีมชนะ</span><h2>{winner.name}</h2><div><strong>{game.teamA.name}</strong><b>{game.teamA.score} : {game.teamB.score}</b><strong>{game.teamB.name}</strong></div></section>
    {game.winnerQueueStatus === "DECIDING_CONTINUE" ? <section className="loser-decision winner-decision"><div><h2>ทีมชนะจะเล่นต่อหรือไม่</h2><p>หัวหน้าทีมชนะเลือกได้หนึ่งครั้ง</p></div>{game.isWinnerCaptain ? <div><form action={decideWinnerContinuationAction}><input type="hidden" name="gameId" value={game.id}/><input type="hidden" name="decision" value="true"/><button>เล่นต่อ</button></form><form action={decideWinnerContinuationAction}><input type="hidden" name="gameId" value={game.id}/><input type="hidden" name="decision" value="false"/><button>ออกจากคิว</button></form></div> : <p>รอหัวหน้าทีมชนะตัดสินใจ</p>}</section> : null}
    {loserDeciding ? <section className="loser-decision"><div><h2>การตัดสินใจของทีมแพ้</h2><DecisionTimer deadline={game.loserDecisionDeadline!}/><p>หากหมดเวลา ระบบจะนำทีมออกจากคิวอัตโนมัติ</p></div>{game.isLoserCaptain ? <div><form action={decideLoserRequeueAction}><input type="hidden" name="gameId" value={game.id}/><input type="hidden" name="decision" value="true"/><button>ต่อท้ายคิว</button></form><form action={decideLoserRequeueAction}><input type="hidden" name="gameId" value={game.id}/><input type="hidden" name="decision" value="false"/><button>ออกจากคิว</button></form></div> : <p>รอหัวหน้าทีมแพ้ตัดสินใจ</p>}</section> : null}
    <section className="individual-results"><h2>คะแนนรายบุคคล</h2>{[game.teamA,game.teamB].map(team=><article key={team.id}><strong>{team.name}</strong>{game.playerScores.filter(score=>score.teamId===team.id).map(score=><p key={score.userId}><span>{score.displayName}</span><b>{score.points}</b></p>)}</article>)}</section>
  </div>;
}
