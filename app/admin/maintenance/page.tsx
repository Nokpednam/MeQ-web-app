import Link from "next/link";
import { AdminMaintenanceSection } from "@/components/admin-maintenance-section";
import { createClient } from "@/lib/supabase/server";
import { getAdminMaintenanceReports } from "@/lib/supabase-maintenance-repository";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage({ searchParams }: { searchParams: Promise<{ maintenance?: string }> }) {
  const supabase = await createClient();
  const [reports, query] = await Promise.all([getAdminMaintenanceReports(supabase), searchParams]);
  return <main className="admin-shell maintenance-all-page">
    <header className="admin-header"><div><p className="section-label">MAINTENANCE</p><h1>จัดการรายการแจ้งซ่อม</h1><p>ตรวจสอบรายงานทั้งหมดและอัปเดตสถานะงาน</p></div><Link className="back-link" href="/admin">← กลับหน้าผู้ดูแล</Link></header>
    {query.maintenance === "saved" ? <div className="queue-success" role="status">บันทึกสถานะแจ้งซ่อมเรียบร้อยแล้ว</div> : null}
    {query.maintenance === "error" ? <div className="team-error" role="alert">บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่</div> : null}
    {query.maintenance === "deleted" ? <div className="queue-success" role="status">ลบรายการแจ้งซ่อมเรียบร้อยแล้ว</div> : null}
    {query.maintenance === "delete-error" ? <div className="team-error" role="alert">ลบรายการไม่สำเร็จ กรุณาลองใหม่</div> : null}
    <AdminMaintenanceSection reports={reports} returnTo="/admin/maintenance"/>
  </main>;
}
