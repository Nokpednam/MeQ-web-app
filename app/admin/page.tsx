import { redirect } from "next/navigation";
import { AdminSupabaseView } from "@/components/admin-supabase-view";
import { AdminMaintenanceSection } from "@/components/admin-maintenance-section";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminData } from "@/lib/supabase-admin-repository";
import { getAdminMaintenanceReports } from "@/lib/supabase-maintenance-repository";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ maintenance?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") redirect("/?notice=admin-only");
  const [data, reports, query] = await Promise.all([getSupabaseAdminData(supabase, user.id), getAdminMaintenanceReports(supabase), searchParams]);
  const viewData = { ...data, newReportCount: reports.filter((report) => report.status === "NEW").length };

  return <>
    <AdminSupabaseView data={viewData}/>
    {viewData.newReportCount > 0 ? <div className="admin-alert-shell"><a className="admin-report-alert" href="#maintenance-reports"><span>!</span><div><strong>มีรายการแจ้งซ่อมใหม่ {viewData.newReportCount} รายการ</strong><small>แตะเพื่อเลื่อนไปตรวจสอบและอัปเดตสถานะ</small></div><b>→</b></a></div> : null}
    <main className="admin-shell admin-maintenance-shell">
      {query.maintenance === "saved" ? <div className="queue-success" role="status">บันทึกสถานะแจ้งซ่อมเรียบร้อยแล้ว และผู้ใช้จะเห็นสถานะล่าสุดทันที</div> : null}
      {query.maintenance === "error" ? <div className="team-error" role="alert">บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่</div> : null}
      <AdminMaintenanceSection reports={reports}/>
    </main>
  </>;
}
