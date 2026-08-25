"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { joinCourtQueueAction } from "@/app/courts/actions";
import type { CourtId } from "@/lib/queue-types";
import type { TeamLocationStatus } from "@/lib/supabase-queue-repository";
import { getNextLocationExpiry, getTeamLocationSummary, isTeamLocationReady } from "@/lib/team-location-rules";

export function TeamLocationStatusList({ statuses, requiredMembers, teamId, courtId, showJoinAction, joinLabel, waitingLabel }: {
  statuses: TeamLocationStatus[];
  requiredMembers: number;
  teamId: string;
  courtId: CourtId;
  showJoinAction: boolean;
  joinLabel: string;
  waitingLabel: string;
}) {
  const [now, setNow] = useState(0);
  const summary = getTeamLocationSummary(statuses, requiredMembers, now);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, [statuses]);
  useEffect(() => {
    if (now === 0) return;
    const currentTime = Date.now();
    const nextExpiry = getNextLocationExpiry(statuses, currentTime);
    if (nextExpiry === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - currentTime) + 25);
    return () => window.clearTimeout(timer);
  }, [statuses, now]);

  return <section className="team-location-status" aria-labelledby="team-location-title">
    <header>
      <div>
        <strong id="team-location-title">สถานะตำแหน่งสมาชิก</strong>
        <small>ต้องยืนยันครบก่อนเข้าคิว</small>
      </div>
      <b>{summary.readyCount}/{requiredMembers} คนพร้อม</b>
    </header>
    <ul>{statuses.map((item) => {
      const ready = isTeamLocationReady(item, now);
      const expired = item.status === "EXPIRED" || (item.expiresAt !== null && Date.parse(item.expiresAt) <= now);
      const remaining = ready && item.expiresAt ? Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now) / 60_000)) : null;
      return <li key={item.userId}>
        <span><strong>{item.displayName}{item.isCurrentUser ? " (คุณ)" : ""}</strong>
          <small>{ready ? (remaining ? `เหลือประมาณ ${remaining} นาที` : `ใช้ได้ถึง ${new Date(item.expiresAt!).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`) : expired ? "การยืนยันหมดอายุ" : "ยังไม่ได้ยืนยัน"}</small>
        </span>
        <b className={ready ? "is-ready" : "is-pending"}>{ready ? "✓ ยืนยันแล้ว" : expired ? "หมดอายุ" : "รอยืนยัน"}</b>
      </li>;
    })}{Array.from({ length: summary.missingSlots }, (_, index) => <li className="is-empty-slot" key={`empty-${index}`}>
      <span><strong>ช่องสมาชิกว่าง</strong><small>เพิ่มสมาชิกให้ครบก่อนเข้าคิว</small></span>
      <b className="is-pending">ยังขาด</b>
    </li>)}</ul>
    {summary.missingSlots > 0 ? <Link className="queue-secondary-button team-location-manage" href={`/teams/${teamId}`}>จัดการสมาชิกทีม</Link> : null}
    {showJoinAction ? <form action={joinCourtQueueAction}>
      <input type="hidden" name="courtId" value={courtId}/>
      <p>{summary.allReady ? joinLabel : waitingLabel}</p>
      <button className="queue-primary-button" disabled={!summary.allReady}>{joinLabel}</button>
    </form> : null}
  </section>;
}
