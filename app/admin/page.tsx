import { redirect } from "next/navigation";
import { AdminSupabaseView } from "@/components/admin-supabase-view";
import { AdminGamesSection } from "@/components/admin-games-section";
import { AdminMaintenanceSection } from "@/components/admin-maintenance-section";
import { createClient } from "@/lib/supabase/server";
import { getAdminActiveGames, getSupabaseAdminData, upcomingAdminEvents } from "@/lib/supabase-admin-repository";
import { getAdminMaintenanceReports } from "@/lib/supabase-maintenance-repository";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ maintenance?: string; game?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") redirect("/?notice=admin-only");
  const [data, reports, games, query] = await Promise.all([getSupabaseAdminData(supabase, user.id), getAdminMaintenanceReports(supabase), getAdminActiveGames(supabase), searchParams]);
  // The admin home shows only the next few events; /admin/events lists them all.
  const upcomingEvents = upcomingAdminEvents(data.events, 3);
  const viewData = { ...data, events: upcomingEvents, newReportCount: reports.filter((report) => report.status === "NEW").length };

  return <>
    <AdminSupabaseView data={viewData} eventTotal={data.events.length}/>
    {viewData.newReportCount > 0 ? <div className="admin-alert-shell"><a className="admin-report-alert" href="/admin/maintenance"><span>!</span><div><strong>มีรายการแจ้งซ่อมใหม่ {viewData.newReportCount} รายการ</strong><small>แตะเพื่อเปิดรายการแจ้งซ่อมทั้งหมด</small></div><b>→</b></a></div> : null}
    <main className="admin-shell admin-maintenance-shell">
      {query.maintenance === "saved" ? <div className="queue-success" role="status">บันทึกสถานะแจ้งซ่อมเรียบร้อยแล้ว และผู้ใช้จะเห็นสถานะล่าสุดทันที</div> : null}
      {query.maintenance === "error" ? <div className="team-error" role="alert">บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่</div> : null}
      {query.maintenance === "deleted" ? <div className="queue-success" role="status">ลบรายการแจ้งซ่อมเรียบร้อยแล้ว</div> : null}
      {query.maintenance === "delete-error" ? <div className="team-error" role="alert">ลบรายการไม่สำเร็จ กรุณาลองใหม่</div> : null}
      {query.game === "cancelled" ? <div className="queue-success" role="status">ยกเลิกเกมแล้ว สนามว่างสำหรับทีมถัดไป</div> : null}
      {query.game === "resolved" ? <div className="queue-success" role="status">บันทึกผลการแข่งขันแล้ว</div> : null}
      {query.game?.startsWith("error-") ? <div className="team-error" role="alert">จัดการเกมไม่สำเร็จ ({query.game.slice(6) === "TIED_SCORE" ? "คะแนนเสมอกันไม่ได้" : query.game.slice(6) === "INVALID_GAME_STATUS" ? "เกมจบหรือถูกยกเลิกไปแล้ว" : query.game.slice(6)})</div> : null}
      <AdminGamesSection games={games}/>
      <AdminMaintenanceSection reports={reports.slice(0, 2)} totalCount={reports.length} showMoreHref="/admin/maintenance"/>
    </main>
  </>;
}
