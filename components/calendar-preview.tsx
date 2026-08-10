"use client";

import { useState } from "react";
import type { DashboardCopy, DashboardLanguage } from "@/lib/dashboard-translations";
import { useAdminData } from "./admin-provider";

const eventMeta = [
  { dateTh: "8 ส.ค.", dateEn: "8 AUG", time: "16:00–20:00", court: "5x5", impact: "high", title: "eventOneTitle", detail: "eventOneDetail" },
  { dateTh: "12 ส.ค.", dateEn: "12 AUG", time: "09:00–10:30", court: "3x3 A / B", impact: "medium", title: "eventTwoTitle", detail: "eventTwoDetail" },
  { dateTh: "18 ส.ค.", dateEn: "18 AUG", time: "05:00–08:00", court: "ALL COURTS", impact: "high", title: "eventThreeTitle", detail: "eventThreeDetail" },
] as const;

export function CalendarPreview({ copy, language }: { copy: DashboardCopy; language: DashboardLanguage }) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const { state } = useAdminData();
  const repositoryEvents = state?.events.filter((event) => event.status === "ACTIVE").sort((a,b)=>a.date.localeCompare(b.date));
  const events = repositoryEvents?.length ? repositoryEvents.map((event) => ({ id:event.id,dateTh:new Date(`${event.date}T00:00:00`).toLocaleDateString("th-TH",{day:"numeric",month:"short"}),dateEn:new Date(`${event.date}T00:00:00`).toLocaleDateString("en-GB",{day:"numeric",month:"short"}).toUpperCase(),time:event.allDay?"ALL DAY":`${event.startTime}–${event.endTime}`,court:event.courtIds.length===3?"ALL COURTS":event.courtIds.map(id=>id.toUpperCase()).join(" / "),impact:event.impact.toLowerCase() as "low"|"medium"|"high",titleText:event.title,detailText:event.details })) : eventMeta.map(event=>({id:`fallback-${event.dateEn}-${event.time}`,...event,titleText:copy[event.title],detailText:copy[event.detail]}));
  const visibleEvents = showAllEvents ? events : events.slice(0, 2);
  return (
    <section className="dashboard-section events-section" aria-labelledby="events-heading">
      <div className="section-heading"><div><p className="section-label">CALENDAR</p><h2 id="events-heading">{copy.upcomingEvents}</h2></div><button className="outline-button" type="button" aria-expanded={showAllEvents} onClick={() => setShowAllEvents((value) => !value)}>{showAllEvents ? copy.showLessCalendar : copy.viewCalendar}<b>{showAllEvents ? "↑" : "→"}</b></button></div>
      <div className="event-list">
        {visibleEvents.map((event) => (
          <article className="event-item" key={event.id}>
            <time>{language === "th" ? event.dateTh : event.dateEn}</time>
            <div className="event-copy"><div><span className={`impact impact-${event.impact}`}>{event.impact === "high" ? copy.impactHigh : event.impact === "medium" ? copy.impactMedium : copy.impactLow}</span><span>{event.court}</span></div><h3>{event.titleText}</h3><p>{event.detailText}</p></div>
            <strong className="event-time">{event.time}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
