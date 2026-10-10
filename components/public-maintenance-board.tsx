"use client";

import Link from "next/link";
import { useMeqLanguage } from "./use-meq-language";
import type { PublicMaintenanceRow } from "@/lib/supabase-maintenance-repository";
import type { CourtId } from "@/lib/queue-types";

const categoryTh: Record<string, string> = { SURFACE: "พื้นสนาม", HOOP: "แป้นหรือห่วง", LIGHTING: "ระบบไฟ", OTHER: "อื่น ๆ" };
const statusTh = { NEW: "รอแอดมินรับเรื่อง", IN_PROGRESS: "แอดมินรับเรื่องแล้ว", WAITING_FOR_CARETAKER: "รอผู้ดูแลสนามเข้ามาซ่อม", RESOLVED: "แก้ไขแล้ว" } as const;
const statusEn = { NEW: "Waiting for admin", IN_PROGRESS: "Admin accepted", WAITING_FOR_CARETAKER: "Waiting for court caretaker", RESOLVED: "Resolved" } as const;

type Props = {
  reports: PublicMaintenanceRow[];
  courtId?: CourtId;
  compact?: boolean;
  totalCount?: number;
  showMoreHref?: string;
};

export function PublicMaintenanceBoard({ reports, courtId, compact = false, totalCount, showMoreHref }: Props) {
  const { language } = useMeqLanguage();
  const visible = courtId ? reports.filter((report) => report.courtId === courtId) : reports;
  const count = totalCount ?? visible.length;

  if (visible.length === 0) return compact ? null : <section className="public-maintenance-board">
    <div className="public-maintenance-heading"><span>–</span><div><strong>{language === "th" ? "ยังไม่มีงานซ่อมที่แอดมินรับเรื่อง" : "No accepted maintenance reports"}</strong><small>{language === "th" ? "รายงานใหม่จะแสดงต่อผู้อื่นหลังแอดมินรับเรื่อง" : "New reports become public after an admin accepts them"}</small></div></div>
  </section>;

  return <section className={`public-maintenance-board${compact ? " is-compact" : ""}`} aria-label={language === "th" ? "สถานะงานซ่อมสนาม" : "Court maintenance status"}>
    <div className="public-maintenance-heading"><span>!</span><div><strong>{language === "th" ? `งานซ่อมที่แอดมินรับเรื่อง ${count} รายการ` : `${count} accepted maintenance report(s)`}</strong><small>{language === "th" ? "ไม่ต้องแจ้งปัญหาประเภทเดิมซ้ำจนกว่างานจะเสร็จ" : "Do not submit the same issue again until it is resolved"}</small></div></div>
    <div className="public-maintenance-list">{visible.map((report) => <article className={`status-${report.status.toLowerCase()}`} key={report.id}>
      <header><strong>{report.courtId.toUpperCase()}</strong><span>{language === "th" ? (categoryTh[report.category] ?? report.category) : report.category}</span><time>{new Date(report.updatedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-GB")}</time></header>
      <p>{report.details}</p>
      <div><span className={`maintenance-status status-${report.status.toLowerCase()}`}>{language === "th" ? statusTh[report.status] : statusEn[report.status]}</span></div>
      {report.adminNote ? <small>{language === "th" ? "อัปเดตจากเจ้าหน้าที่" : "Staff update"}: {report.adminNote}</small> : null}
    </article>)}</div>
    {showMoreHref && count > visible.length ? <Link className="maintenance-more-link" href={showMoreHref}>{language === "th" ? `ดูเพิ่มเติม (${count - visible.length})` : `View more (${count - visible.length})`} →</Link> : null}
  </section>;
}
