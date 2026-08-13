import Image from "next/image";
import { updateMaintenanceStatusAction } from "@/app/maintenance/actions";
import type { AdminMaintenanceRow } from "@/lib/supabase-maintenance-repository";

export function AdminMaintenanceSection({ reports }: { reports: AdminMaintenanceRow[] }) {
  return <section className="admin-section" id="maintenance-reports">
    <div className="admin-section-heading"><div><p className="section-label">MAINTENANCE</p><h2>รายการแจ้งซ่อม</h2><p>รายการจากผู้ใช้งานและหลักฐานรูปภาพใน Supabase Storage</p></div></div>
    {reports.length === 0 ? <p className="admin-empty">ยังไม่มีรายการแจ้งซ่อม</p> : <div className="admin-report-list">{reports.map((report) => <article className={report.status === "NEW" ? "is-new" : ""} key={report.id}>
      <div><strong>{report.courtId.toUpperCase()}</strong><span>{report.category}</span><time>{new Date(report.createdAt).toLocaleString("th-TH")}</time></div>
      <div className="admin-report-detail"><p>{report.details}</p>{report.imageUrl ? <a className="admin-report-image" href={report.imageUrl} aria-label="เปิดรูปแจ้งซ่อมขนาดเต็ม"><Image src={report.imageUrl} alt="รูปประกอบรายการแจ้งซ่อม" width={320} height={180} unoptimized/><span>แตะเพื่อดูรูปขนาดเต็ม →</span></a> : <span className="admin-report-no-image">ไม่มีรูปประกอบ</span>}</div>
      <form action={updateMaintenanceStatusAction}><input type="hidden" name="reportId" value={report.id}/><select name="status" defaultValue={report.status} aria-label={`สถานะ ${report.courtId}`}><option value="NEW">รายการใหม่</option><option value="IN_PROGRESS">กำลังดำเนินการ</option><option value="RESOLVED">แก้ไขแล้ว</option></select><input className="admin-entry" name="adminNote" defaultValue={report.adminNote ?? ""} placeholder="หมายเหตุแอดมิน"/><button className="queue-primary-button">บันทึกสถานะ</button></form>
    </article>)}</div>}
  </section>;
}
