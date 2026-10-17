"use client";
import Link from "next/link";
import { useMeqLanguage } from "./use-meq-language";
import { adminTranslations } from "@/lib/admin-translations";
import type { SupabaseAdminData } from "@/lib/supabase-admin-repository";
import { AdminEventsSection } from "./admin-events-section";
import {
  setCheckInDurationAction,
  setCourtOpenAction,
  setTargetScoreAction,
} from "@/app/admin/actions";
export function AdminSupabaseView({
  data,
  eventTotal,
}: {
  data: SupabaseAdminData;
  eventTotal: number;
}) {
  const { language, selectLanguage } = useMeqLanguage();
  const copy = adminTranslations[language];
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="section-label">ADMIN / SUPABASE</p>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="admin-header-actions">
          <div className="language-switcher">
            <button
              className={language === "th" ? "is-active" : ""}
              onClick={() => selectLanguage("th")}
            >
              TH
            </button>
            <button
              className={language === "en" ? "is-active" : ""}
              onClick={() => selectLanguage("en")}
            >
              EN
            </button>
          </div>
          <Link className="queue-secondary-button" href="/">
            ← {copy.back}
          </Link>
        </div>
      </header>
      <div className="admin-mock-banner">
        <b>DB</b>
        <span>
          {language === "th"
            ? "ข้อมูลและสิทธิ์จัดการจาก Supabase"
            : "Data and permissions from Supabase"}
        </span>
      </div>
      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <p className="section-label">OVERVIEW</p>
            <h2>{copy.overview}</h2>
          </div>
        </div>
        <dl className="admin-kpis">
          <div>
            <dt>{copy.openCourts}</dt>
            <dd>{data.courts.filter((c) => c.isOpen).length}/3</dd>
          </div>
          <div>
            <dt>{copy.activeQueues}</dt>
            <dd>{data.waitingCount}</dd>
          </div>
          <div>
            <dt>{copy.activeGames}</dt>
            <dd>{data.activeGameCount}</dd>
          </div>
          <div>
            <dt>{copy.newReports}</dt>
            <dd>{data.newReportCount}</dd>
          </div>
        </dl>
      </section>
      <div className="admin-two-column">
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="section-label">COURTS</p>
              <h2>{copy.courtControl}</h2>
              <p>{copy.courtHint}</p>
            </div>
          </div>
          <div className="admin-court-list">
            {data.courts.map((court) => (
              <article key={court.id}>
                <div>
                  <strong>{court.name}</strong>
                  <small>
                    {court.format === "THREE_X_THREE" ? "3x3" : "5x5"}
                  </small>
                </div>
                <form action={setCourtOpenAction}>
                  <input type="hidden" name="courtId" value={court.id} />
                  <input
                    type="hidden"
                    name="isOpen"
                    value={String(!court.isOpen)}
                  />
                  <button
                    className={court.isOpen ? "is-open" : "is-closed"}
                    aria-pressed={court.isOpen}
                  >
                    <i />
                    {court.isOpen ? copy.open : copy.closed}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="section-label">TARGET SCORE</p>
              <h2>{copy.targetScores}</h2>
              <p>{copy.targetHint}</p>
            </div>
          </div>
          <div className="admin-score-settings">
            {[...new Map(data.courts.map((c) => [c.groupId, c])).values()].map(
              (group) => (
                <article key={group.groupId}>
                  <header>
                    <strong>
                      {group.groupId === "3x3" ? "3x3 A / B" : "5x5"}
                    </strong>
                    <b>{group.targetScore}</b>
                  </header>
                  <div>
                    {group.allowedScores.map((score) => (
                      <form action={setTargetScoreAction} key={score}>
                        <input
                          type="hidden"
                          name="groupId"
                          value={group.groupId}
                        />
                        <input type="hidden" name="score" value={score} />
                        <button
                          className={
                            score === group.targetScore ? "is-active" : ""
                          }
                        >
                          {score}
                        </button>
                      </form>
                    ))}
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      </div>
      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <p className="section-label">CHECK-IN</p>
            <h2>{copy.checkInDuration}</h2>
            <p>{copy.checkInDurationHint}</p>
          </div>
        </div>
        <div className="admin-score-settings">
          <article>
            <header>
              <strong>{copy.currentDuration}</strong>
              <b>{Math.round(data.checkInDurationSeconds / 60)} {copy.minutes}</b>
            </header>
            <div>
              {[60, 120, 180, 300].map((seconds) => (
                <form action={setCheckInDurationAction} key={seconds}>
                  <input type="hidden" name="durationSeconds" value={seconds} />
                  <button className={seconds === data.checkInDurationSeconds ? "is-active" : ""}>
                    {seconds / 60} {copy.minutes}
                  </button>
                </form>
              ))}
            </div>
          </article>
        </div>
      </section>
      <AdminEventsSection events={data.events} courts={data.courts} totalCount={eventTotal} />
    </main>
  );
}
