"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { submitTeamScoresAction } from "@/app/games/actions";
import { invalidScoreReason } from "@/lib/game-status-copy";
import type { SupabaseGameData } from "@/lib/supabase-game-repository";
import { ScoreDeadline } from "./score-deadline";

function SubmitScoresButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending}>{pending ? "กำลังส่งคะแนน…" : "ส่งคะแนนทีม"}</button>;
}

export function SupabaseGameScores({ game }: { game: SupabaseGameData }) {
  const search = useSearchParams();
  const team = game.captainTeamId === game.teamA.id ? game.teamA : game.captainTeamId === game.teamB.id ? game.teamB : null;
  const other = team?.id === game.teamA.id ? game.teamB : game.teamA;
  const submitted = team ? game.submittedTeamIds.includes(team.id) : false;
  const otherSubmitted = game.submittedTeamIds.includes(other.id);
  const error = search.get("error");
  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">SCORE SUBMISSION</p><h1>บันทึกคะแนนหลังเกม</h1><p>เป้าหมาย {game.targetScore} แต้ม · ทีมชนะต้องถึงเป้าหมาย ทีมแพ้ต้องยังไม่ถึง</p></div><Link href={`/games/${game.id}`}>← กลับเกม</Link></header>
    {error && error !== "INVALID_SCORE" ? <div className="team-error" role="alert">ส่งคะแนนไม่สำเร็จ: {error === "SCORE_DEADLINE_PASSED" ? "หมดเวลาส่งคะแนนแล้ว" : error === "INCOMPLETE_PLAYERS" ? "กรอกคะแนนให้ครบทุกคน" : error.replaceAll("_", " ")}</div> : null}
    {game.scoreDeadline && ["END_REQUESTED", "AWAITING_SCORE", "INVALID_SCORE"].includes(game.status) ? <ScoreDeadline deadline={game.scoreDeadline}/> : null}
    {game.status === "INVALID_SCORE" ? <div className="team-error" role="alert"><strong>คะแนนไม่ผ่าน: {invalidScoreReason(game.invalidReason, game.targetScore)}</strong><br/>ทั้งสองทีมต้องตรวจคะแนนแล้วส่งใหม่</div> : null}
    {!team ? <p>เฉพาะหัวหน้าทีมหรือผู้ช่วยหัวหน้าที่กำลังแข่งเท่านั้นที่กรอกคะแนนได้</p> : submitted ? <section className="score-form score-submitted" role="status">
      <div className="score-form-head"><div><small>{team.name}</small><strong>ส่งคะแนนแล้ว</strong></div><span>รวม {team.members.reduce((sum, member) => sum + member.points, 0)} แต้ม</span></div>
      <ul>{team.members.map(member => <li key={member.userId}><span>{member.displayName}</span><b>{member.points}</b></li>)}</ul>
      <p className="queue-success">{otherSubmitted ? "อีกทีมส่งแล้ว กำลังตรวจผล…" : `รอทีม ${other.name} ส่งคะแนน หน้านี้จะไปที่ผลการแข่งขันเองเมื่อเกมจบ`}</p>
    </section> : <form className="score-form" action={submitTeamScoresAction}>
      <input type="hidden" name="gameId" value={game.id}/>
      <div className="score-form-head"><div><small>{team.name}</small><strong>คะแนนของทีมคุณ</strong></div><span>ยังไม่ส่ง</span></div>
      <p className="score-zero-note">ผู้เล่นที่ไม่ได้ทำแต้มให้กรอก 0 · ส่งได้ครั้งเดียว ตรวจให้ถูกก่อนกดส่ง</p>
      {team.members.map(member=><label key={member.userId}><span className="member-avatar">{member.displayName.slice(0,2)}</span><strong>{member.displayName}</strong><input name={`score:${member.userId}`} inputMode="numeric" pattern="[0-9]*" min="0" step="1" required defaultValue={member.points}/></label>)}
      <p>อีกทีม ({other.name}): <b>{otherSubmitted ? "ส่งคะแนนแล้ว" : "ยังไม่ส่ง"}</b></p>
      <div><Link className="team-secondary-button" href={`/games/${game.id}`}>กลับ</Link><SubmitScoresButton/></div>
    </form>}
  </div>;
}
