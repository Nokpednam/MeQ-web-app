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

type DeviceGuide = "ios" | "android" | "other";

function browserError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "เบราว์เซอร์ไม่ได้รับสิทธิ์ตำแหน่ง ดูวิธีเปิดสิทธิ์ด้านล่างแล้วกดตรวจอีกครั้ง";
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
  const [deviceGuide, setDeviceGuide] = useState<DeviceGuide>("other");
  const watchId = useRef<number | null>(null);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopWatching() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timeoutId.current !== null) clearTimeout(timeoutId.current);
    watchId.current = null;
    timeoutId.current = null;
  }

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const frame = window.requestAnimationFrame(() => {
      setDeviceGuide(/iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        ? "ios"
        : /Android/i.test(userAgent) ? "android" : "other");
    });
    return () => {
      window.cancelAnimationFrame(frame);
      stopWatching();
    };
  }, []);

  async function submitPosition(position: GeolocationPosition) {
    const { latitude, longitude, accuracy } = position.coords;
    const result = await verifyCourtLocationAction(courtId, latitude, longitude, accuracy);
    setStatus(result.ok
      ? { kind: "success", distance: result.distanceMetres, expiresAt: result.expiresAt }
      : { kind: "error", message: serverError(result.error, accuracy) });
    if (result.ok) router.refresh();
  }

  function verify() {
    if (!window.isSecureContext) {
      setStatus({ kind: "error", message: "การตรวจตำแหน่งต้องเปิดผ่านเว็บไซต์ https ที่ปลอดภัย" });
      return;
    }
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
      else setStatus({ kind: "error", message: deviceGuide === "ios"
        ? "iPhone/iPad ยังไม่ส่งตำแหน่งมา กรุณาเปิดบริการหาตำแหน่งให้ Safari แล้วกดตรวจอีกครั้ง"
        : "ยังไม่ได้รับตำแหน่งจากโทรศัพท์ กรุณาเปิด GPS แล้วกดตรวจอีกครั้ง" });
    }, 20_000);
  }

  return <div className="court-location-verifier">
    <p>สมาชิกแต่ละคนต้องยืนยันตำแหน่งก่อนเข้าคิว การยืนยันมีอายุ 10 นาที</p>
    <details className="location-permission-guide" open={status.kind === "error"}>
      <summary>{deviceGuide === "ios" ? "วิธีเปิดตำแหน่งบน iPhone / iPad" : deviceGuide === "android" ? "วิธีเปิดตำแหน่งบน Android" : "วิธีอนุญาตตำแหน่ง"}</summary>
      {deviceGuide === "ios" ? <><ol>
        <li>เปิดหน้านี้ด้วย <b>Safari</b></li>
        <li>แตะ <b>กก</b> ข้างแถบที่อยู่ → การตั้งค่าเว็บไซต์ → ตำแหน่งที่ตั้ง → <b>อนุญาต</b></li>
        <li>เปิด การตั้งค่าเครื่อง → ความเป็นส่วนตัวและความปลอดภัย → บริการหาตำแหน่ง → Safari Websites และเปิด <b>ตำแหน่งที่ตั้งจริง</b></li>
      </ol><small>ถ้าเปิดจาก LINE แล้วไม่ทำงาน ให้แตะเมนูแชร์แล้วเลือก “เปิดใน Safari” การรีเฟรชอย่างเดียวจะไม่เปลี่ยนสิทธิ์ที่เคยเลือกไว้</small></> : <><ol>
        <li>เมื่อเบราว์เซอร์ถาม ให้เลือก <b>ตำแหน่งที่แม่นยำ</b></li>
        <li>เลือก <b>อนุญาตขณะเข้าชมเว็บไซต์</b></li>
      </ol><small>ถ้าเคยเลือกผิด ให้แตะไอคอนตั้งค่าข้าง URL → สิทธิ์ → ตำแหน่ง แล้วเปลี่ยนเป็นอนุญาต</small></>}
    </details>
    <button className="queue-secondary-button" type="button" onClick={verify} disabled={status.kind === "checking"}>
      {status.kind === "checking" ? "กำลังตรวจตำแหน่ง…" : status.kind === "error" ? "ลองตรวจตำแหน่งอีกครั้ง" : "ยืนยันตำแหน่ง GPS"}
    </button>
    {status.kind === "checking" ? <div className="location-checking" role="status" aria-live="polite">กำลังขอตำแหน่งจากอุปกรณ์ อาจใช้เวลาสูงสุด 20 วินาที…</div> : null}
    {status.kind === "success" ? <div className="queue-success" role="status">
      ยืนยันแล้ว · ห่างจากจุดทดสอบ {Math.round(status.distance)} เมตร · ใช้ได้ถึง {new Date(status.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
    </div> : null}
    {status.kind === "error" ? <div className="team-error" role="alert">{status.message}</div> : null}
  </div>;
}
