"use client";

import { confirmGameTargetScoreAction, proposeGameTargetScoreAction } from "@/app/courts/actions";
import type { SupabaseQueueData } from "@/lib/supabase-queue-repository";
import type { CourtId } from "@/lib/queue-types";

export function PregameTargetScore({ data, courtId }: { data: SupabaseQueueData; courtId: CourtId }) {
  const sessions = data.checkIns.filter((item) => item.court_id === courtId);
  const team = data.teamData.currentTeam;
  const ownSession = sessions.find((item) => item.team_id === team?.id);
  const court = data.courts.find((item) => item.id === courtId);
  const proposal = data.targetProposals.find((item) => item.court_id === courtId);
  if (sessions.length !== 2 || !team || !ownSession || !court) return null;

  return <section className="checkin-section court-page">
    <div className="section-heading"><div><p className="section-label">TARGET SCORE</p><h2>คะแนนเป้าหมายเกมนี้</h2></div></div>
    <div className="pregame-target-panel">
      {proposal ? <>
        <p><strong>{proposal.target_score} แต้ม</strong> · {proposal.status === "CONFIRMED" ? "ทั้งสองทีมยืนยันแล้ว" : "รออีกทีมยืนยัน"}</p>
        {proposal.status === "PENDING" && proposal.proposed_by_team_id !== team.id ? <form action={confirmGameTargetScoreAction}>
          <input type="hidden" name="courtId" value={courtId}/><input type="hidden" name="proposalId" value={proposal.id}/>
          <button type="submit">ยืนยันใช้ {proposal.target_score} แต้ม</button>
        </form> : null}
      </> : <form action={proposeGameTargetScoreAction}>
        <input type="hidden" name="courtId" value={courtId}/><input type="hidden" name="checkInId" value={ownSession.id}/>
        <label>เสนอคะแนน <select name="targetScore" defaultValue={court.targetScore}>{court.allowedTargetScores.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>
        <button type="submit">ส่งข้อเสนอให้อีกทีม</button>
      </form>}
      <small>หากไม่มีข้อเสนอ เกมจะใช้คะแนนประจำวันที่ผู้ดูแลตั้งไว้</small>
    </div>
  </section>;
}
