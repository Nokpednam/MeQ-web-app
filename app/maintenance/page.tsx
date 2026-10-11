import Link from "next/link";
import { redirect } from "next/navigation";
import { MaintenanceHistoryList } from "@/components/maintenance-history-list";
import { PublicMaintenanceBoard } from "@/components/public-maintenance-board";
import { createClient } from "@/lib/supabase/server";
import { getMyMaintenanceReports, getPublicMaintenanceReports } from "@/lib/supabase-maintenance-repository";

export const dynamic = "force-dynamic";

export default async function MaintenanceReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/maintenance");
  const [myReports, publicReports] = await Promise.all([getMyMaintenanceReports(supabase), getPublicMaintenanceReports(supabase)]);

  return <main className="court-page maintenance-all-page">
    <header className="team-page-heading"><div><p className="section-label">MAINTENANCE REPORTS</p><h1>รายการแจ้งซ่อมทั้งหมด</h1><p>ติดตามรายงานของคุณและงานที่แอดมินรับเรื่องแล้ว</p></div><Link className="back-link" href="/maintenance/new">← กลับหน้าแจ้งซ่อม</Link></header>
    <PublicMaintenanceBoard reports={publicReports}/>
    <section className="admin-section maintenance-history"><div className="admin-section-heading"><div><p className="section-label">MY REPORTS</p><h2>รายการที่ฉันแจ้งทั้งหมด</h2><p>เลื่อนดูประวัติและสถานะล่าสุดจากเจ้าหน้าที่</p></div></div><MaintenanceHistoryList reports={myReports}/></section>
  </main>;
}
