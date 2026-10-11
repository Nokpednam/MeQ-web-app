import Link from "next/link";
import { redirect } from "next/navigation";
import { MaintenanceHistoryList } from "@/components/maintenance-history-list";
import { MaintenanceReportForm } from "@/components/maintenance-report-form";
import { PublicMaintenanceBoard } from "@/components/public-maintenance-board";
import { createClient } from "@/lib/supabase/server";
import { getMyMaintenanceReports, getPublicMaintenanceReports } from "@/lib/supabase-maintenance-repository";

const errorCopy: Record<string, string> = {
  invalid: "กรุณาเลือกสนาม ประเภทปัญหา และกรอกรายละเอียด 5–1,000 ตัวอักษร",
  image: "แนบได้เฉพาะรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB",
  upload: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  duplicate: "สนามนี้มีรายงานปัญหาประเภทเดียวกันที่ยังไม่แก้ไข จึงยังส่งซ้ำไม่ได้",
  save: "บันทึกรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export default async function MaintenanceNewPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/maintenance/new");
  const query = await searchParams;
  const [myReports, publicReports] = await Promise.all([getMyMaintenanceReports(supabase), getPublicMaintenanceReports(supabase)]);

  return <main className="court-page">
    <header className="team-page-heading"><div><p className="section-label">MAINTENANCE</p><h1>แจ้งซ่อมสนาม</h1><p>แจ้งอุปกรณ์หรือพื้นที่ชำรุด พร้อมแนบรูปได้ไม่เกิน 5 MB</p></div><Link className="back-link" href="/">← กลับ Dashboard</Link></header>
    {query.success ? <div className="queue-success" role="status">ส่งรายการเรียบร้อยแล้ว รายงานนี้จะแสดงให้คุณและแอดมินเห็นก่อน</div> : null}
    {query.error ? <div className="team-error" role="alert">{errorCopy[query.error] ?? "ส่งรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"}</div> : null}
    <PublicMaintenanceBoard reports={publicReports.slice(0, 2)} totalCount={publicReports.length} showMoreHref="/maintenance"/>
    <section className="admin-section"><MaintenanceReportForm/></section>
    <section className="admin-section maintenance-history"><div className="admin-section-heading"><div><p className="section-label">MY REPORTS</p><h2>รายการที่ฉันแจ้ง</h2><p>รายงานใหม่จะยังไม่แสดงให้ผู้ใช้อื่นเห็นจนกว่าแอดมินจะรับเรื่อง</p></div></div><MaintenanceHistoryList reports={myReports.slice(0, 2)} totalCount={myReports.length} showMoreHref="/maintenance"/></section>
  </main>;
}
