"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { submitTeamScoresAction } from "@/app/games/actions";
import type { SupabaseGameData } from "@/lib/supabase-game-repository";

export function SupabaseGameScores({ game }: { game: SupabaseGameData }) {
  const search = useSearchParams();
  const team = game.captainTeamId === game.teamA.id ? game.teamA : game.captainTeamId === game.teamB.id ? game.teamB : null;
  const other = team?.id === game.teamA.id ? game.teamB : game.teamA;
  const submitted = team ? game.submittedTeamIds.includes(team.id) : false;
  const otherSubmitted = game.submittedTeamIds.includes(other.id);
  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">SCORE SUBMISSION / SUPABASE</p><h1>บันทึกคะแนนหลังเกม</h1><p>กรอกคะแนนรายบุคคลของทีมคุณ ระบบจะคำนวณผลรวมให้</p></div><Link href={`/games/${game.id}`}>← กลับเกม</Link></header>
    {search.get("notice") ? <div className="queue-success" role="status">ส่งคะแนนแล้ว กำลังรออีกทีมส่งคะแนน</div> : null}
    {search.get("error") ? <div className="team-error" role="alert">คะแนนไม่ผ่านการตรวจสอบ: {search.get("error")?.replaceAll("_"," ")}</div> : null}
    {game.status === "INVALID_SCORE" ? <div className="team-error" role="alert">ผลคะแนนไม่ถูกต้อง: {game.invalidReason?.replaceAll("_"," ")}</div> : null}
    {team ? <form className="score-form" action={submitTeamScoresAction}>
      <input type="hidden" name="gameId" value={game.id}/>
      <div className="score-form-head"><div><small>{team.name}</small><strong>คะแนนของทีมคุณ</strong></div><span>{submitted ? "ส่งแล้ว—แก้ไขได้" : "ยังไม่ส่ง"}</span></div>
      <p className="score-zero-note">ผู้เล่นที่ไม่ได้ทำแต้มให้กรอก 0</p>
      {team.members.map(member=><label key={member.userId}><span className="member-avatar">{member.displayName.slice(0,2)}</span><strong>{member.displayName}</strong><input name={`score:${member.userId}`} inputMode="numeric" pattern="[0-9]*" min="0" step="1" required defaultValue={member.points}/></label>)}
      <p>อีกทีม ({other.name}): <b>{otherSubmitted ? "ส่งคะแนนแล้ว" : "ยังไม่ส่ง"}</b></p>
      <div><Link className="team-secondary-button" href={`/games/${game.id}`}>กลับ</Link><button type="submit">ส่งคะแนนทีม</button></div>
    </form> : <p>เฉพาะหัวหน้าทีมที่แข่งขันอยู่เท่านั้นที่กรอกคะแนนได้</p>}
  </div>;
}
