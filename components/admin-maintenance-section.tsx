import Image from "next/image";
import Link from "next/link";
import { updateMaintenanceStatusAction, deleteMaintenanceReportAction } from "@/app/maintenance/actions";
import type { AdminMaintenanceRow } from "@/lib/supabase-maintenance-repository";

export function AdminMaintenanceSection({ reports, totalCount, showMoreHref, returnTo = "/admin" }: { reports: AdminMaintenanceRow[]; totalCount?: number; showMoreHref?: string; returnTo?: "/admin" | "/admin/maintenance" }) {
  const count = totalCount ?? reports.length;
  return <section className="admin-section" id="maintenance-reports">
    <div className="admin-section-heading"><div><p className="section-label">MAINTENANCE</p><h2>รายการแจ้งซ่อม</h2><p>ตรวจสอบรายงานและอัปเดตสถานะให้ผู้ใช้ทราบ</p></div></div>
    {reports.length === 0 ? <p className="admin-empty">ยังไม่มีรายการแจ้งซ่อม</p> : <div className="admin-report-list">{reports.map((report) => <article className={report.status === "NEW" ? "is-new" : ""} key={report.id}>
      <div><strong>{report.courtId.toUpperCase()}</strong><span>{report.category}</span><time>{new Date(report.createdAt).toLocaleString("th-TH")}</time></div>
      <div className="admin-report-detail"><p>{report.details}</p>{report.imageUrl ? <a className="admin-report-image" href={report.imageUrl} aria-label="เปิดรูปแจ้งซ่อมขนาดเต็ม"><Image src={report.imageUrl} alt="รูปประกอบรายการแจ้งซ่อม" width={320} height={180} unoptimized/><span>แตะเพื่อดูรูปขนาดเต็ม →</span></a> : <span className="admin-report-no-image">ไม่มีรูปประกอบ</span>}</div>
      <div className="admin-report-actions">
        <form action={updateMaintenanceStatusAction}><input type="hidden" name="reportId" value={report.id}/><input type="hidden" name="returnTo" value={returnTo}/><select name="status" defaultValue={report.status} aria-label={`สถานะ ${report.courtId}`}><option value="NEW">รายการใหม่</option><option value="IN_PROGRESS">แอดมินรับเรื่องแล้ว</option><option value="WAITING_FOR_CARETAKER">รอผู้ดูแลสนามเข้ามาซ่อม</option><option value="RESOLVED">แก้ไขแล้ว</option></select><input className="admin-entry" name="adminNote" defaultValue={report.adminNote ?? ""} placeholder="หมายเหตุแอดมิน"/><button className="queue-primary-button">บันทึกสถานะ</button></form>
        <details className="admin-delete-confirm">
          <summary className="admin-delete-trigger" aria-label={`ลบรายการแจ้งซ่อม ${report.courtId}`}>🗑</summary>
          <div className="admin-delete-popover">
            <p>ต้องการลบรายการนี้ถาวรหรือไม่?</p>
            <form action={deleteMaintenanceReportAction}>
              <input type="hidden" name="reportId" value={report.id}/>
              <input type="hidden" name="returnTo" value={returnTo}/>
              <button type="submit" className="admin-delete-confirm-btn">ยืนยันลบ</button>
            </form>
          </div>
        </details>
      </div>
    </article>)}</div>}
    {showMoreHref && count > reports.length ? <Link className="maintenance-more-link" href={showMoreHref}>ดูรายงานทั้งหมด ({count}) →</Link> : null}
  </section>;
}
