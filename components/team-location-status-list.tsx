"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TeamLocationStatus } from "@/lib/supabase-queue-repository";

function isReady(item: TeamLocationStatus, now: number) {
  if (item.status !== "VERIFIED" || !item.expiresAt) return false;
  return now === 0 || Date.parse(item.expiresAt) > now;
}

export function TeamLocationStatusList({ statuses, requiredMembers, teamId }: {
  statuses: TeamLocationStatus[];
  requiredMembers: number;
  teamId: string;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, []);
  const readyCount = statuses.filter((item) => isReady(item, now)).length;
  const missingSlots = Math.max(0, requiredMembers - statuses.length);

  return <section className="team-location-status" aria-labelledby="team-location-title">
    <header>
      <div>
        <strong id="team-location-title">สถานะตำแหน่งสมาชิก</strong>
        <small>ต้องยืนยันครบก่อนเข้าคิว</small>
      </div>
      <b>{readyCount}/{requiredMembers} คนพร้อม</b>
    </header>
    <ul>{statuses.map((item) => {
      const ready = isReady(item, now);
      const expired = item.status === "EXPIRED" || (item.expiresAt !== null && now > 0 && Date.parse(item.expiresAt) <= now);
      const remaining = ready && item.expiresAt && now > 0 ? Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / 60_000)) : null;
      return <li key={item.userId}>
        <span><strong>{item.displayName}{item.isCurrentUser ? " (คุณ)" : ""}</strong>
          <small>{ready ? (remaining ? `เหลือประมาณ ${remaining} นาที` : `ใช้ได้ถึง ${new Date(item.expiresAt!).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`) : expired ? "การยืนยันหมดอายุ" : "ยังไม่ได้ยืนยัน"}</small>
        </span>
        <b className={ready ? "is-ready" : "is-pending"}>{ready ? "✓ ยืนยันแล้ว" : expired ? "หมดอายุ" : "รอยืนยัน"}</b>
      </li>;
    })}{Array.from({ length: missingSlots }, (_, index) => <li className="is-empty-slot" key={`empty-${index}`}>
      <span><strong>ช่องสมาชิกว่าง</strong><small>เพิ่มสมาชิกให้ครบก่อนเข้าคิว</small></span>
      <b className="is-pending">ยังขาด</b>
    </li>)}</ul>
    {missingSlots > 0 ? <Link className="queue-secondary-button team-location-manage" href={`/teams/${teamId}`}>จัดการสมาชิกทีม</Link> : null}
  </section>;
}
