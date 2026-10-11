"use client";
import { useEffect, useRef, useTransition } from "react";
import { completeOnboardingAction } from "@/app/onboarding/actions";
import { LineAddFriendButton } from "./line-add-friend-button";

const steps = [
  { title: "รวมทีม", body: "สร้างทีมหรือรับคำเชิญจากเพื่อน 3x3 ต้องมี 3 คน 5x5 ต้องมี 5 คน ครบแล้วลงคิวได้" },
  { title: "ลงคิวสนาม", body: "เลือกสนาม 3x3 A, 3x3 B หรือ 5x5 แล้วดูลำดับคิวของทุกทีมได้แบบสด" },
  { title: "ถึงคิว เช็กอินที่สนาม", body: "ยืนยันตำแหน่งให้ทันเวลา ถ้าไม่เช็กอิน ระบบจะข้ามคิวให้ทีมถัดไป" },
  { title: "อุปกรณ์พัง แจ้งซ่อม", body: "ถ่ายรูปส่งแอดมินได้ทันที และติดตามสถานะได้จนซ่อมเสร็จ" },
];

/** First-login guide on the home page. Closing it marks the account as onboarded. */
export function WelcomeGuide({ displayName, open }: { displayName: string; open: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);

  function finish() {
    dialogRef.current?.close();
  }

  return <dialog ref={dialogRef} className="welcome-guide" aria-labelledby="welcome-title"
    onClose={() => startSaving(() => completeOnboardingAction())}>
    <div className="welcome-guide-body">
      <p className="section-label">ยินดีต้อนรับ</p>
      <h2 id="welcome-title">สวัสดี {displayName} เริ่มใช้ MeQ ใน 4 ขั้น</h2>
      <ol className="welcome-steps">
        {steps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.body}</p></div></li>)}
      </ol>
      <div className="welcome-line">
        <div>
          <strong>ไม่พลาดคิว รับแจ้งเตือนทาง LINE</strong>
          <p>เพิ่ม MeQ เป็นเพื่อน แล้วระบบจะส่งข้อความหาคุณทันทีที่ถึงคิวทีม</p>
        </div>
        <LineAddFriendButton/>
      </div>
      <button className="queue-primary-button welcome-start" type="button" onClick={finish} disabled={isSaving}>เริ่มใช้งาน</button>
    </div>
  </dialog>;
}
