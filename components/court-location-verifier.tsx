"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyCourtLocationAction } from "@/app/courts/actions";
import type { CourtId } from "@/lib/queue-types";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "success"; distance: number; expiresAt: string }
  | { kind: "error"; message: string };

function browserError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "ยังไม่ได้อนุญาตตำแหน่ง แตะไอคอนตั้งค่าข้าง URL → สิทธิ์ → ตำแหน่ง แล้วเลือกอนุญาต";
  if (error.code === error.POSITION_UNAVAILABLE) return "ไม่พบตำแหน่งปัจจุบัน กรุณาเปิด GPS แล้วลองใหม่";
  if (error.code === error.TIMEOUT) return "ค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่ในพื้นที่เปิด";
  return "ตรวจตำแหน่งไม่สำเร็จ กรุณาลองใหม่";
}

function serverError(code: string, accuracyMetres: number) {
  const copy: Record<string, string> = {
    OUT_OF_RANGE: "คุณอยู่นอกพื้นที่ทดสอบ 300 เมตรจากคณะ",
    LOCATION_ACCURACY_TOO_LOW: `โทรศัพท์รายงานความคลาดเคลื่อนประมาณ ±${Math.round(accuracyMetres)} เมตร ให้เปลี่ยนสิทธิ์ตำแหน่งเป็น “แน่นอน” แล้วลองอีกครั้ง`,
    INVALID_COORDINATES: "ข้อมูลตำแหน่งไม่ถูกต้อง กรุณาลองใหม่",
    COURT_LOCATION_NOT_CONFIGURED: "สนามนี้ยังไม่ได้ตั้งค่าตำแหน่ง",
    AUTH_REQUIRED: "กรุณาเข้าสู่ระบบอีกครั้ง",
  };
  return copy[code] ?? "ยืนยันตำแหน่งไม่สำเร็จ กรุณาลองใหม่";
}

export function CourtLocationVerifier({ courtId }: { courtId: CourtId }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const watchId = useRef<number | null>(null);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopWatching() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timeoutId.current !== null) clearTimeout(timeoutId.current);
    watchId.current = null;
    timeoutId.current = null;
  }

  useEffect(() => stopWatching, []);

  async function submitPosition(position: GeolocationPosition) {
    const { latitude, longitude, accuracy } = position.coords;
    const result = await verifyCourtLocationAction(courtId, latitude, longitude, accuracy);
    setStatus(result.ok
      ? { kind: "success", distance: result.distanceMetres, expiresAt: result.expiresAt }
      : { kind: "error", message: serverError(result.error, accuracy) });
    if (result.ok) router.refresh();
  }

  function verify() {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", message: "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง" });
      return;
    }
    stopWatching();
    setStatus({ kind: "checking" });
    let bestPosition: GeolocationPosition | null = null;
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) bestPosition = position;
        if (position.coords.accuracy <= 150) {
          stopWatching();
          void submitPosition(position);
        }
      },
      (error) => {
        stopWatching();
        setStatus({ kind: "error", message: browserError(error) });
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    timeoutId.current = setTimeout(() => {
      stopWatching();
      if (bestPosition) void submitPosition(bestPosition);
      else setStatus({ kind: "error", message: "ยังไม่ได้รับตำแหน่งจากโทรศัพท์ภายใน 15 วินาที กรุณาลองใหม่" });
    }, 15_000);
  }

  return <div className="court-location-verifier">
    <p>สมาชิกแต่ละคนต้องยืนยันตำแหน่งก่อนเข้าคิว การยืนยันมีอายุ 10 นาที</p>
    <div className="location-permission-guide">
      <strong>เมื่อ Chrome ถาม ให้เลือกตามนี้</strong>
      <ol>
        <li><b>แน่นอน</b> — ตำแหน่งที่แน่นอน</li>
        <li><b>อนุญาตขณะเข้าชมเว็บไซต์</b></li>
      </ol>
      <small>ถ้าเลือกผิด การรีเว็บอย่างเดียวจะไม่ล้างสิทธิ์ ให้แตะไอคอนตั้งค่าข้าง URL → สิทธิ์ → ตำแหน่ง แล้วแก้เป็น “แน่นอน”</small>
    </div>
    <button className="queue-secondary-button" type="button" onClick={verify} disabled={status.kind === "checking"}>
      {status.kind === "checking" ? "กำลังตรวจตำแหน่ง…" : status.kind === "error" ? "ลองตรวจตำแหน่งอีกครั้ง" : "ยืนยันตำแหน่ง GPS"}
    </button>
    {status.kind === "success" ? <div className="queue-success" role="status">
      ยืนยันแล้ว · ห่างจากจุดทดสอบ {Math.round(status.distance)} เมตร · ใช้ได้ถึง {new Date(status.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
    </div> : null}
    {status.kind === "error" ? <div className="team-error" role="alert">{status.message}</div> : null}
  </div>;
}
