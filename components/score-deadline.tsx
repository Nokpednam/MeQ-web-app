"use client";
import { useEffect, useState } from "react";

/** Live "time left to submit scores" label. The database enforces the deadline. */
export function ScoreDeadline({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const end = new Date(deadline).getTime();
  const seconds = Math.max(0, Math.floor((end - now) / 1000));
  const clock = new Date(deadline).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  if (seconds === 0) {
    return <div className="score-deadline is-over" role="status">หมดเวลาส่งคะแนนแล้ว ถ้าส่งไม่ครบ เกมนี้จะไม่มีผล</div>;
  }
  return <div className={`score-deadline${seconds <= 60 ? " is-urgent" : ""}`} role="timer">
    <strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong>
    <span>ส่งคะแนนให้ครบทั้ง 2 ทีมภายใน {clock} น. ถ้าไม่ทัน เกมนี้จะไม่มีผลและสนามจะว่างให้ทีมถัดไป</span>
  </div>;
}
