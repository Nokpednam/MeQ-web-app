"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cancelGameEndAction, rejectGameEndAction, requestGameEndAction } from "@/app/games/actions";
import { gameStatusLabel, invalidScoreReason } from "@/lib/game-status-copy";
import type { SupabaseGameData } from "@/lib/supabase-game-repository";
import { ScoreDeadline } from "./score-deadline";

export function SupabaseGameStatus({ game }: { game: SupabaseGameData }) {
  const search = useSearchParams();
  const isCaptain = game.captainTeamId !== null;
  const ownsRequest = game.requestedByUserId === game.currentUserId;
  const opposingCaptain = isCaptain && game.requestedByTeamId !== game.captainTeamId;
  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">GAME / SUPABASE</p><h1>{game.teamA.name} <b>VS</b> {game.teamB.name}</h1><p>สนาม {game.courtId.toUpperCase()} · เป้าหมาย {game.targetScore} แต้ม</p></div><Link href={`/courts/${game.courtId}`}>← กลับสนาม</Link></header>
    {search.get("notice") ? <div className="queue-success" role="status">บันทึกรายการเรียบร้อยแล้ว</div> : null}
    {search.get("error") ? <div className="team-error" role="alert">ทำรายการไม่สำเร็จ: {search.get("error")?.replaceAll("_"," ")}</div> : null}
    <section className="game-scoreboard"><span>{gameStatusLabel(game.status)}</span><div><strong>{game.teamA.name}</strong><b>VS</b><strong>{game.teamB.name}</strong></div><small>เริ่มเมื่อ {new Date(game.startedAt).toLocaleTimeString("th-TH")}</small></section>
    {game.scoreDeadline && ["END_REQUESTED", "AWAITING_SCORE", "INVALID_SCORE"].includes(game.status) ? <ScoreDeadline deadline={game.scoreDeadline}/> : null}
    {game.status === "INVALID_SCORE" ? <div className="team-error" role="alert">คะแนนไม่ผ่าน: {invalidScoreReason(game.invalidReason, game.targetScore)} ทั้งสองทีมต้องส่งคะแนนใหม่</div> : null}
    {game.status === "CANCELLED" ? <div className="team-error" role="status">เกมนี้ไม่มีผล ({game.invalidReason === "SCORE_TIMEOUT" ? "ส่งคะแนนไม่ครบภายในเวลา" : game.invalidReason === "ADMIN_CANCELLED" ? "แอดมินยกเลิกเกม" : "ยกเลิก"}) ทั้งสองทีมลงคิวใหม่ได้</div> : null}
    <section className="game-actions"><h2>การแข่งขัน</h2>
      {game.status === "PLAYING" && isCaptain ? <form action={requestGameEndAction}><input type="hidden" name="gameId" value={game.id}/><button>จบเกมและกรอกคะแนน</button></form> : null}
      {game.status === "END_REQUESTED" && ownsRequest ? <><Link href={`/games/${game.id}/scores`}>กรอกคะแนนทีม</Link><form action={cancelGameEndAction}><input type="hidden" name="gameId" value={game.id}/><button className="game-secondary-action">ยกเลิกคำขอ</button></form><p>ส่งคะแนนทีมคุณแล้วรออีกทีมยืนยันด้วยการส่งคะแนน</p></> : null}
      {game.status === "END_REQUESTED" && opposingCaptain ? <><Link href={`/games/${game.id}/scores`}>กรอกคะแนนเพื่อยืนยันจบเกม</Link><form action={rejectGameEndAction}><input type="hidden" name="gameId" value={game.id}/><button className="game-secondary-action">เกมยังไม่จบ</button></form></> : null}
      {(game.status === "AWAITING_SCORE" || game.status === "INVALID_SCORE") && isCaptain ? <Link href={`/games/${game.id}/scores`}>กรอกหรือแก้ไขคะแนนทีม</Link> : null}
      {game.status === "COMPLETED" ? <Link href={`/games/${game.id}/result`}>ดูผลการแข่งขัน</Link> : null}
      {!isCaptain ? <p>ผู้เล่นทั่วไปดูสถานะได้ แต่เฉพาะหัวหน้าทีมหรือผู้ช่วยหัวหน้าที่ได้รับมอบสิทธิ์ดำเนินการได้</p> : null}
    </section>
  </div>;
}
