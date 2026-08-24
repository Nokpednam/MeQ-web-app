import Link from "next/link";
import { redirect } from "next/navigation";
import { MaintenanceReportForm } from "@/components/maintenance-report-form";
import { PublicMaintenanceBoard } from "@/components/public-maintenance-board";
import { createClient } from "@/lib/supabase/server";
import { getMyMaintenanceReports, getPublicMaintenanceReports } from "@/lib/supabase-maintenance-repository";

const statusCopy = { NEW: "รับเรื่องแล้ว", IN_PROGRESS: "กำลังดำเนินการ", RESOLVED: "แก้ไขแล้ว" } as const;
const errorCopy: Record<string, string> = {
  invalid: "กรุณาเลือกสนาม ประเภทปัญหา และกรอกรายละเอียด 5–1,000 ตัวอักษร",
  image: "แนบได้เฉพาะรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB",
  upload: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  save: "บันทึกรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export default async function MaintenancePage({searchParams}:{searchParams:Promise<{success?:string;error?:string}>}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/maintenance/new");
  const query = await searchParams;
  const [reports, publicReports] = await Promise.all([getMyMaintenanceReports(supabase), getPublicMaintenanceReports(supabase)]);

  return <main className="court-page">
    <header className="team-page-heading"><div><p className="section-label">MAINTENANCE</p><h1>แจ้งซ่อมสนาม</h1><p>แจ้งอุปกรณ์หรือพื้นที่ชำรุด พร้อมแนบรูปได้ไม่เกิน 5 MB</p></div><Link className="back-link" href="/">← กลับ Dashboard</Link></header>
    {query.success ? <div className="queue-success" role="status">ส่งรายการแจ้งซ่อมเรียบร้อยแล้ว</div> : null}
    {query.error ? <div className="team-error" role="alert">{errorCopy[query.error] ?? "ส่งรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"}</div> : null}
    <PublicMaintenanceBoard reports={publicReports}/>
    <section className="admin-section"><MaintenanceReportForm/></section>
    <section className="admin-section maintenance-history"><div className="admin-section-heading"><div><p className="section-label">MY REPORTS</p><h2>รายการที่ฉันแจ้ง</h2><p>ติดตามสถานะล่าสุดที่เจ้าหน้าที่บันทึกไว้</p></div></div>{reports.length === 0 ? <p className="admin-empty">ยังไม่มีรายการแจ้งซ่อม</p> : <ol>{reports.map((report) => <li key={report.id}><div><strong>{report.courtId.toUpperCase()}</strong><span>{report.category}</span><time>{new Date(report.createdAt).toLocaleString("th-TH")}</time></div><p>{report.details}</p><span className={`maintenance-status status-${report.status.toLowerCase()}`}>{statusCopy[report.status]}</span>{report.adminNote ? <small>หมายเหตุจากเจ้าหน้าที่: {report.adminNote}</small> : null}</li>)}</ol>}</section>
  </main>;
}
