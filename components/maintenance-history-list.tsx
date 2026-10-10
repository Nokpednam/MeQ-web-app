import Link from "next/link";
import { maintenanceCategoryLabel, maintenanceCourtName, maintenanceStatusCopy } from "@/lib/maintenance-copy";
import type { MyMaintenanceRow } from "@/lib/supabase-maintenance-repository";

export function MaintenanceHistoryList({ reports, totalCount, showMoreHref }: { reports: MyMaintenanceRow[]; totalCount?: number; showMoreHref?: string }) {
  const count = totalCount ?? reports.length;
  if (reports.length === 0) return <p className="admin-empty">ยังไม่มีรายการแจ้งซ่อม</p>;
  return <>
    <ol>{reports.map((report) => <li key={report.id}>
      <div><strong>{maintenanceCourtName(report.courtId)}</strong><span>{maintenanceCategoryLabel(report.category)}</span><time>{new Date(report.createdAt).toLocaleString("th-TH")}</time></div>
      <p>{report.details}</p>
      <span className={`maintenance-status status-${report.status.toLowerCase()}`}>{maintenanceStatusCopy.th[report.status]}</span>
      {report.adminNote ? <small>หมายเหตุจากเจ้าหน้าที่: {report.adminNote}</small> : null}
    </li>)}</ol>
    {showMoreHref && count > reports.length ? <Link className="maintenance-more-link" href={showMoreHref}>ดูเพิ่มเติม ({count - reports.length}) →</Link> : null}
  </>;
}
