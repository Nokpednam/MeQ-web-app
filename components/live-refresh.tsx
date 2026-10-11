"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LIVE_REFRESH_INTERVAL_MS, secondsSince, shouldRefreshNow } from "@/lib/live-refresh-rules";

function currentContext() {
  const active = document.activeElement as HTMLElement | null;
  return {
    documentHidden: document.visibilityState === "hidden",
    online: navigator.onLine,
    activeTagName: active?.tagName ?? null,
    activeIsContentEditable: Boolean(active?.isContentEditable),
  };
}

/** Re-renders the current route from the server every few seconds. */
export function LiveRefresh({ language }: { language: "th" | "en" }) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      if (!shouldRefreshNow(currentContext())) return;
      router.refresh();
      setLastRefreshAt(Date.now());
    };
    const timer = window.setInterval(refresh, LIVE_REFRESH_INTERVAL_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    // Coming back to the tab should show the latest queue straight away.
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [router]);

  const seconds = secondsSince(lastRefreshAt, now);
  const label = language === "th"
    ? `อัปเดตอัตโนมัติ · ${seconds < 5 ? "เมื่อสักครู่" : `${seconds} วินาทีที่แล้ว`}`
    : `Auto-updating · ${seconds < 5 ? "just now" : `${seconds}s ago`}`;
  return <small className="live-refresh" aria-live="off"><span className="live-refresh-dot" aria-hidden="true"/>{label}</small>;
}
