"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MeQ route rendering failed", error);
  }, [error]);

  return (
    <main className="route-error" role="alert">
      <span aria-hidden="true">!</span>
      <p className="section-label">CONNECTION ERROR</p>
      <h1>โหลดข้อมูลไม่สำเร็จ</h1>
      <p>ระบบอาจเชื่อมต่อฐานข้อมูลไม่ได้ชั่วคราว กรุณาลองอีกครั้ง</p>
      <div>
        <button type="button" onClick={reset}>ลองอีกครั้ง</button>
        <Link href="/">กลับหน้าหลัก</Link>
      </div>
    </main>
  );
}
