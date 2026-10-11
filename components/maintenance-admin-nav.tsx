import Link from "next/link";
import { formatMaintenanceHours, type MaintenanceStats } from "@/lib/maintenance-stats";

/** Tabs shared by the admin maintenance list and statistics pages. */
export function MaintenanceAdminTabs({ active, openCount }: { active: "list" | "stats"; openCount?: number }) {
  return <nav className="maintenance-admin-tabs" aria-label="งานแจ้งซ่อม">
    <Link className={active === "list" ? "is-active" : ""} aria-current={active === "list" ? "page" : undefined} href="/admin/maintenance">
      <span aria-hidden="true">📋</span>รายการแจ้งซ่อม{openCount ? <b>{openCount}</b> : null}
    </Link>
    <Link className={active === "stats" ? "is-active" : ""} aria-current={active === "stats" ? "page" : undefined} href="/admin/maintenance/stats">
      <span aria-hidden="true">📊</span>สถิติ
    </Link>
  </nav>;
}

/** Compact 30-day summary shown above the report list. */
export function MaintenanceStatsStrip({ stats }: { stats: MaintenanceStats }) {
  return <Link className="maintenance-stats-strip" href="/admin/maintenance/stats" aria-label="ดูสถิติแจ้งซ่อมทั้งหมด">
    <div><span>30 วันล่าสุด</span><strong>{stats.total} รายงาน</strong></div>
    <div><span>ยังค้างอยู่</span><strong>{stats.open}</strong></div>
    <div><span>ตอบรับใน (มัธยฐาน)</span><strong>{formatMaintenanceHours(stats.medianResponseHours)}</strong></div>
    <div><span>ซ่อมเสร็จใน (มัธยฐาน)</span><strong>{formatMaintenanceHours(stats.medianResolutionHours)}</strong></div>
    <b>ดูสถิติเต็ม →</b>
  </Link>;
}
