"use client";

import { useState } from "react";
import { verifyCourtLocationAction } from "@/app/courts/actions";
import type { CourtId } from "@/lib/queue-types";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "success"; distance: number; expiresAt: string }
  | { kind: "error"; message: string };

function browserError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งให้เว็บไซต์";
  if (error.code === error.POSITION_UNAVAILABLE) return "ไม่พบตำแหน่งปัจจุบัน กรุณาเปิด GPS แล้วลองใหม่";
  if (error.code === error.TIMEOUT) return "ค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่ในพื้นที่เปิด";
  return "ตรวจตำแหน่งไม่สำเร็จ กรุณาลองใหม่";
}

function serverError(code: string) {
  const copy: Record<string, string> = {
    OUT_OF_RANGE: "คุณอยู่นอกพื้นที่ทดสอบ 300 เมตรจากคณะ",
    LOCATION_ACCURACY_TOO_LOW: "ความแม่นยำของตำแหน่งต่ำเกินไป กรุณาออกไปยังพื้นที่เปิดแล้วลองใหม่",
    INVALID_COORDINATES: "ข้อมูลตำแหน่งไม่ถูกต้อง กรุณาลองใหม่",
    COURT_LOCATION_NOT_CONFIGURED: "สนามนี้ยังไม่ได้ตั้งค่าตำแหน่ง",
    AUTH_REQUIRED: "กรุณาเข้าสู่ระบบอีกครั้ง",
  };
  return copy[code] ?? "ยืนยันตำแหน่งไม่สำเร็จ กรุณาลองใหม่";
}

export function CourtLocationVerifier({ courtId }: { courtId: CourtId }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function verify() {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", message: "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง" });
      return;
    }
    setStatus({ kind: "checking" });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const result = await verifyCourtLocationAction(courtId, coords.latitude, coords.longitude, coords.accuracy);
        setStatus(result.ok
          ? { kind: "success", distance: result.distanceMetres, expiresAt: result.expiresAt }
          : { kind: "error", message: serverError(result.error) });
      },
      (error) => setStatus({ kind: "error", message: browserError(error) }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return <div className="court-location-verifier">
    <p>สมาชิกแต่ละคนต้องยืนยันตำแหน่งก่อนเข้าคิว การยืนยันมีอายุ 10 นาที</p>
    <button className="queue-secondary-button" type="button" onClick={verify} disabled={status.kind === "checking"}>
      {status.kind === "checking" ? "กำลังตรวจตำแหน่ง…" : "ยืนยันตำแหน่ง GPS"}
    </button>
    {status.kind === "success" ? <div className="queue-success" role="status">
      ยืนยันแล้ว · ห่างจากจุดทดสอบ {Math.round(status.distance)} เมตร · ใช้ได้ถึง {new Date(status.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
    </div> : null}
    {status.kind === "error" ? <div className="team-error" role="alert">{status.message}</div> : null}
  </div>;
}

