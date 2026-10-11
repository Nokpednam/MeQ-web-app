import Link from "next/link";
import { adminCancelGameAction, adminResolveGameAction } from "@/app/admin/actions";
import { maintenanceCourtName } from "@/lib/maintenance-copy";
import type { AdminActiveGame } from "@/lib/supabase-admin-repository";

const statusLabel: Record<string, string> = {
  PLAYING: "กำลังแข่ง",
  END_REQUESTED: "ขอจบเกม รอคะแนน",
  AWAITING_SCORE: "รอคะแนนอีกทีม",
  VALIDATING_RESULT: "กำลังตรวจผล",
  INVALID_SCORE: "คะแนนไม่ผ่าน",
};

/** Games that still hold a court, with admin tools to cancel or decide them. */
export function AdminGamesSection({ games }: { games: AdminActiveGame[] }) {
  return <section className="admin-section" id="active-games">
    <div className="admin-section-heading"><div><p className="section-label">GAMES</p><h2>เกมที่ยังไม่จบ</h2><p>ใช้เมื่อเกมค้างหรือสองทีมตกลงผลกันไม่ได้ เกมที่ขอจบแล้วจะถูกยกเลิกอัตโนมัติถ้าส่งคะแนนไม่ครบภายในเวลา</p></div></div>
    {games.length === 0 ? <p className="admin-empty">ไม่มีเกมที่ค้างอยู่</p> : <div className="admin-game-list">{games.map((game) => <article key={game.id}>
      <div className="admin-game-head">
        <strong>{maintenanceCourtName(game.courtId)}</strong>
        <span className={`admin-game-status status-${game.status.toLowerCase()}`}>{statusLabel[game.status] ?? game.status}</span>
        <small>เริ่ม {new Date(game.startedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{game.scoreDeadline ? ` · หมดเวลาส่งคะแนน ${new Date(game.scoreDeadline).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""}</small>
      </div>
      <p className="admin-game-teams">{game.teamAName} <b>vs</b> {game.teamBName} · เป้าหมาย {game.targetScore}</p>
      <div className="admin-game-actions">
        <form action={adminResolveGameAction} className="admin-game-resolve">
          <input type="hidden" name="gameId" value={game.id}/>
          <label><span>{game.teamAName}</span><input name="teamAScore" type="number" min="0" inputMode="numeric" required/></label>
          <label><span>{game.teamBName}</span><input name="teamBScore" type="number" min="0" inputMode="numeric" required/></label>
          <button className="queue-primary-button">ตัดสินผล</button>
        </form>
        <form action={adminCancelGameAction}>
          <input type="hidden" name="gameId" value={game.id}/>
          <button className="admin-game-cancel">ยกเลิกเกม (ไม่มีผล)</button>
        </form>
        <Link className="admin-game-open" href={`/games/${game.id}`}>เปิดหน้าเกม</Link>
      </div>
    </article>)}</div>}
  </section>;
}
