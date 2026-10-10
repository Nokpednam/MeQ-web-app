import Link from "next/link";
import type { MyMaintenanceRow } from "@/lib/supabase-maintenance-repository";

const statusCopy = { NEW: "รอแอดมินรับเรื่อง", IN_PROGRESS: "แอดมินรับเรื่องแล้ว", WAITING_FOR_CARETAKER: "รอผู้ดูแลสนามเข้ามาซ่อม", RESOLVED: "แก้ไขแล้ว" } as const;
const categoryCopy: Record<string, string> = { SURFACE: "พื้นสนาม", HOOP: "แป้นหรือห่วง", LIGHTING: "ระบบไฟ", OTHER: "อื่น ๆ" };

export function MaintenanceHistoryList({ reports, totalCount, showMoreHref }: { reports: MyMaintenanceRow[]; totalCount?: number; showMoreHref?: string }) {
  const count = totalCount ?? reports.length;
  if (reports.length === 0) return <p className="admin-empty">ยังไม่มีรายการแจ้งซ่อม</p>;
  return <>
    <ol>{reports.map((report) => <li key={report.id}>
      <div><strong>{report.courtId.toUpperCase()}</strong><span>{categoryCopy[report.category] ?? report.category}</span><time>{new Date(report.createdAt).toLocaleString("th-TH")}</time></div>
      <p>{report.details}</p>
      <span className={`maintenance-status status-${report.status.toLowerCase()}`}>{statusCopy[report.status]}</span>
      {report.adminNote ? <small>หมายเหตุจากเจ้าหน้าที่: {report.adminNote}</small> : null}
    </li>)}</ol>
    {showMoreHref && count > reports.length ? <Link className="maintenance-more-link" href={showMoreHref}>ดูเพิ่มเติม ({count - reports.length}) →</Link> : null}
  </>;
}
