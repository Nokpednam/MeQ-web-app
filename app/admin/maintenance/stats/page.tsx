import Link from "next/link";
import { MaintenanceAdminTabs } from "@/components/maintenance-admin-nav";
import { createClient } from "@/lib/supabase/server";
import { getAdminMaintenanceStats } from "@/lib/supabase-maintenance-repository";
import { maintenanceCategoryLabel, maintenanceCourtName, maintenanceStatusCopy } from "@/lib/maintenance-copy";
import { bucketPercent, formatMaintenanceHours, maintenanceStatsPeriods, parseMaintenanceStatsPeriod, type MaintenanceStatsBucket } from "@/lib/maintenance-stats";
import type { MaintenanceStatus } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

const statusOrder: MaintenanceStatus[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_CARETAKER", "RESOLVED", "REJECTED"];

function BucketList({ buckets, label }: { buckets: MaintenanceStatsBucket[]; label: (key: string) => string }) {
  if (buckets.length === 0) return <p className="admin-empty">ยังไม่มีข้อมูลในช่วงนี้</p>;
  return <ul className="maintenance-stats-bars">{buckets.map((bucket) => <li key={bucket.key}>
    <span>{label(bucket.key)}</span>
    <div><i style={{ width: `${bucketPercent(bucket.total, buckets)}%` }}/></div>
    <strong>{bucket.total}</strong>
  </li>)}</ul>;
}

export default async function AdminMaintenanceStatsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const query = await searchParams;
  const days = parseMaintenanceStatsPeriod(query.days);
  const supabase = await createClient();
  const stats = await getAdminMaintenanceStats(supabase, days);
  const activePeriod = days === null ? "all" : String(days);

  return <main className="admin-shell maintenance-all-page">
    <header className="admin-header"><div><p className="section-label">MAINTENANCE STATS</p><h1>สถิติแจ้งซ่อม</h1><p>ภาพรวมรายงาน เวลาตอบรับ และเวลาซ่อมเสร็จ</p></div><div className="admin-header-actions"><Link className="queue-secondary-button" href="/admin">← กลับหน้าผู้ดูแล</Link></div></header>
    <MaintenanceAdminTabs active="stats"/>

    <nav className="maintenance-stats-periods" aria-label="ช่วงเวลา">{maintenanceStatsPeriods.map((period) =>
      <Link key={period.value} className={period.value === activePeriod ? "is-active" : ""} href={`/admin/maintenance/stats?days=${period.value}`}>{period.label}</Link>)}
    </nav>

    <section className="admin-section">
      <dl className="admin-kpis maintenance-stats-kpis">
        <div><dt>รายงานทั้งหมด</dt><dd>{stats.total}</dd></div>
        <div><dt>ยังค้างอยู่</dt><dd>{stats.open}</dd></div>
        <div><dt>เวลาตอบรับ (มัธยฐาน)</dt><dd>{formatMaintenanceHours(stats.medianResponseHours)}</dd><small>เฉลี่ย {formatMaintenanceHours(stats.avgResponseHours)}</small></div>
        <div><dt>เวลาซ่อมเสร็จ (มัธยฐาน)</dt><dd>{formatMaintenanceHours(stats.medianResolutionHours)}</dd><small>เฉลี่ย {formatMaintenanceHours(stats.avgResolutionHours)} · {stats.resolvedCount} งาน</small></div>
      </dl>
      {stats.oldestOpenHours !== null ? <p className="maintenance-stats-note">งานที่ค้างนานที่สุดแจ้งมาแล้ว {formatMaintenanceHours(stats.oldestOpenHours)}</p> : null}
    </section>

    <div className="admin-two-column">
      <section className="admin-section"><div className="admin-section-heading"><div><p className="section-label">BY COURT</p><h2>แยกตามสนาม</h2></div></div><BucketList buckets={stats.byCourt} label={maintenanceCourtName}/></section>
      <section className="admin-section"><div className="admin-section-heading"><div><p className="section-label">BY CATEGORY</p><h2>แยกตามประเภทปัญหา</h2></div></div><BucketList buckets={stats.byCategory} label={(key) => maintenanceCategoryLabel(key)}/></section>
    </div>

    <section className="admin-section"><div className="admin-section-heading"><div><p className="section-label">BY STATUS</p><h2>แยกตามสถานะ</h2></div></div>
      <BucketList buckets={statusOrder.map((status) => ({ key: status, total: stats.byStatus[status] ?? 0 }))} label={(key) => maintenanceStatusCopy.th[key as MaintenanceStatus] ?? key}/>
    </section>

    <p className="maintenance-stats-note">เวลาตอบรับ = ตั้งแต่แจ้งจนแอดมินเปลี่ยนสถานะครั้งแรก · เวลาซ่อมเสร็จ = ตั้งแต่แจ้งจนสถานะ &quot;แก้ไขแล้ว&quot; · รายงานก่อนวันที่ 10 ต.ค. 2569 ใช้เวลาโดยประมาณ</p>
  </main>;
}
