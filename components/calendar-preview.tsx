import type { DashboardCopy, DashboardLanguage } from "@/lib/dashboard-translations";

const eventMeta = [
  { dateTh: "8 ส.ค.", dateEn: "8 AUG", time: "16:00–20:00", court: "5x5", impact: "high", title: "eventOneTitle", detail: "eventOneDetail" },
  { dateTh: "12 ส.ค.", dateEn: "12 AUG", time: "09:00–10:30", court: "3x3 A / B", impact: "medium", title: "eventTwoTitle", detail: "eventTwoDetail" },
  { dateTh: "18 ส.ค.", dateEn: "18 AUG", time: "05:00–08:00", court: "ALL COURTS", impact: "high", title: "eventThreeTitle", detail: "eventThreeDetail" },
] as const;

export function CalendarPreview({ copy, language }: { copy: DashboardCopy; language: DashboardLanguage }) {
  return (
    <section className="dashboard-section events-section" aria-labelledby="events-heading">
      <div className="section-heading"><div><p className="section-label">CALENDAR</p><h2 id="events-heading">{copy.upcomingEvents}</h2></div><button className="outline-button" type="button">{copy.viewCalendar}<b>→</b></button></div>
      <div className="event-list">
        {eventMeta.map((event) => (
          <article className="event-item" key={event.dateEn}>
            <time>{language === "th" ? event.dateTh : event.dateEn}</time>
            <div className="event-copy"><div><span className={`impact impact-${event.impact}`}>{event.impact === "high" ? copy.impactHigh : event.impact === "medium" ? copy.impactMedium : copy.impactLow}</span><span>{event.court}</span></div><h3>{copy[event.title]}</h3><p>{copy[event.detail]}</p></div>
            <strong className="event-time">{event.time}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
