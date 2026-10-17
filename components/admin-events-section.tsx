"use client";
import Link from "next/link";
import { useMeqLanguage } from "./use-meq-language";
import { adminTranslations } from "@/lib/admin-translations";
import type {
  AdminEventRow,
  SupabaseAdminData,
} from "@/lib/supabase-admin-repository";
import {
  cancelCourtEventAction,
  saveCourtEventAction,
} from "@/app/admin/actions";

type AdminCourt = SupabaseAdminData["courts"][number];
type AdminLabels = typeof adminTranslations.th;

function dateParts(event: AdminEventRow) {
  const start = new Date(event.startsAt),
    end = new Date(event.endsAt);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
  return {
    date,
    start: start.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
    }),
    end: end.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
function EventForm({
  event,
  courts,
  labels,
}: {
  event?: AdminEventRow;
  courts: AdminCourt[];
  labels: AdminLabels;
}) {
  const value = event ? dateParts(event) : null;
  return (
    <form className="admin-event-form" action={saveCourtEventAction}>
      {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <h3>{event ? labels.editEvent : labels.createEvent}</h3>
      <label>
        <span>{labels.eventTitle}</span>
        <input
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue={event?.title}
        />
      </label>
      <label>
        <span>{labels.details}</span>
        <textarea name="details" rows={3} defaultValue={event?.details} />
      </label>
      <label>
        <span>{labels.date}</span>
        <input type="date" name="date" required defaultValue={value?.date} />
      </label>
      <label className="admin-check">
        <input type="checkbox" name="allDay" defaultChecked={event?.allDay} />
        <span>{labels.allDay}</span>
      </label>
      <div className="admin-form-row">
        <label>
          <span>{labels.start}</span>
          <input
            type="time"
            name="startTime"
            defaultValue={value?.start ?? "09:00"}
          />
        </label>
        <label>
          <span>{labels.end}</span>
          <input
            type="time"
            name="endTime"
            defaultValue={value?.end ?? "10:00"}
          />
        </label>
      </div>
      <fieldset>
        <legend>{labels.courts}</legend>
        {courts.map((court) => (
          <label className="admin-check" key={court.id}>
            <input
              type="checkbox"
              name="courtIds"
              value={court.id}
              defaultChecked={event?.courtIds.includes(court.id)}
            />
            <span>{court.name}</span>
          </label>
        ))}
      </fieldset>
      <button className="queue-primary-button">{labels.save}</button>
    </form>
  );
}

/**
 * Event form and event list. On the admin home page (`preview`) the caller
 * passes only the next upcoming events and the section links to the full list
 * and the public calendar; `/admin/events` passes every event.
 */
export function AdminEventsSection({
  events,
  courts,
  totalCount,
  preview = true,
}: {
  events: AdminEventRow[];
  courts: AdminCourt[];
  totalCount?: number;
  preview?: boolean;
}) {
  const { language } = useMeqLanguage();
  const copy = adminTranslations[language];
  const count = totalCount ?? events.length;
  return (
    <section className="admin-section admin-calendar" id="court-events">
      <div className="admin-section-heading">
        <div>
          <p className="section-label">CALENDAR</p>
          <h2>{copy.calendar}</h2>
          <p>{preview ? copy.calendarPreviewHint : copy.calendarHint}</p>
        </div>
        <div className="maintenance-heading-actions">
          {preview ? (
            <Link className="queue-secondary-button" href="/admin/events">
              {copy.viewAllEvents}
            </Link>
          ) : null}
          <Link className="queue-primary-button" href="/calendar">
            {copy.viewCalendar}
          </Link>
        </div>
      </div>
      <div className="admin-calendar-grid">
        <EventForm courts={courts} labels={copy} />
        <div className="admin-event-list">
          {events.length === 0 ? (
            <p className="admin-empty">
              {preview ? copy.noUpcomingEvents : copy.noEvents}
            </p>
          ) : (
            events.map((event) => {
              const value = dateParts(event);
              return (
                <article
                  className={event.cancelledAt ? "is-cancelled" : ""}
                  key={event.id}
                >
                  <header>
                    <div>
                      <strong>{event.title}</strong>
                      <span>
                        {event.cancelledAt ? copy.cancelled : copy.active}
                      </span>
                    </div>
                    <time>
                      {value.date} ·{" "}
                      {event.allDay
                        ? copy.allDay
                        : `${value.start}–${value.end}`}
                    </time>
                  </header>
                  <p>{event.details}</p>
                  <small>
                    {event.courtIds.map((id) => id.toUpperCase()).join(" · ")}
                  </small>
                  {!event.cancelledAt ? (
                    <footer>
                      <details>
                        <summary>{copy.edit}</summary>
                        <EventForm event={event} courts={courts} labels={copy} />
                      </details>
                      <form action={cancelCourtEventAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <button>{copy.cancelEvent}</button>
                      </form>
                    </footer>
                  ) : null}
                </article>
              );
            })
          )}
          {preview && count > events.length ? (
            <Link className="maintenance-more-link" href="/admin/events">
              {copy.viewAllEventsCount.replace("{count}", String(count))}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
