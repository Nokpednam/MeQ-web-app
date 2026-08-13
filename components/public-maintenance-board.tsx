"use client";

import { useMeqLanguage } from "./use-meq-language";
import type { PublicMaintenanceRow } from "@/lib/supabase-maintenance-repository";
import type { CourtId } from "@/lib/queue-types";

const categoryTh:Record<string,string>={SURFACE:"พื้นสนาม",HOOP:"แป้นหรือห่วง",LIGHTING:"ระบบไฟ",OTHER:"อื่น ๆ"};
const statusTh={NEW:"รับเรื่องแล้ว",IN_PROGRESS:"กำลังดำเนินการ",RESOLVED:"แก้ไขแล้ว"} as const;
const statusEn={NEW:"Received",IN_PROGRESS:"In progress",RESOLVED:"Resolved"} as const;

export function PublicMaintenanceBoard({ reports, courtId, compact=false }: { reports:PublicMaintenanceRow[];courtId?:CourtId;compact?:boolean }) {
  const { language } = useMeqLanguage();
  const courtReports = courtId ? reports.filter(report=>report.courtId===courtId) : reports;
  // Court pages warn only about work that still affects play. Resolved reports
  // remain on the maintenance page as recent public history.
  const visible = compact ? courtReports.filter(report=>report.status!=="RESOLVED") : courtReports;
  const active = visible.filter(report=>report.status!=="RESOLVED");
  const resolved = visible.filter(report=>report.status==="RESOLVED");
  if (visible.length===0) return compact ? null : <section className="public-maintenance-board"><div className="public-maintenance-heading"><span>✓</span><div><strong>{language==="th"?"ยังไม่มีปัญหาสนามที่เปิดอยู่":"No open court issues"}</strong><small>{language==="th"?"หากพบความเสียหายสามารถแจ้งผ่านแบบฟอร์มด้านล่าง":"Report damage using the form below"}</small></div></div></section>;

  return <section className={`public-maintenance-board${compact?" is-compact":""}`} aria-label={language==="th"?"สถานะงานซ่อมสนาม":"Court maintenance status"}>
    <div className="public-maintenance-heading"><span>{active.length?"!":"✓"}</span><div><strong>{active.length?(language==="th"?`มีปัญหาที่แจ้งแล้ว ${active.length} รายการ`:`${active.length} reported issue(s)`):(language==="th"?"ปัญหาล่าสุดได้รับการแก้ไขแล้ว":"Recent issues have been resolved")}</strong><small>{active.length?(language==="th"?"ไม่ต้องแจ้งซ้ำ เจ้าหน้าที่กำลังติดตามสถานะ":"No duplicate report is needed"):(language==="th"?"แสดงประวัติงานที่ปิดในช่วง 7 วันที่ผ่านมา":"Showing work resolved in the last 7 days")}</small></div></div>
    <div className="public-maintenance-list">{[...active,...resolved].map(report=><article className={`status-${report.status.toLowerCase()}`} key={report.id}><header><strong>{report.courtId.toUpperCase()}</strong><span>{language==="th"?(categoryTh[report.category]??report.category):report.category}</span><time>{new Date(report.updatedAt).toLocaleDateString(language==="th"?"th-TH":"en-GB")}</time></header><p>{report.details}</p><div><span className={`maintenance-status status-${report.status.toLowerCase()}`}>{language==="th"?statusTh[report.status]:statusEn[report.status]}</span>{report.status!=="RESOLVED"?<b>{language==="th"?"มีผู้แจ้งปัญหานี้แล้ว":"Already reported"}</b>:null}</div>{report.adminNote?<small>{language==="th"?"อัปเดตจากเจ้าหน้าที่":"Staff update"}: {report.adminNote}</small>:null}</article>)}</div>
  </section>;
}
