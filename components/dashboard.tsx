"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPreview } from "@/components/calendar-preview";
import { CourtCard } from "@/components/court-card";
import { dashboardTranslations, type DashboardLanguage } from "@/lib/dashboard-translations";
import { courts, games, playerStats } from "@/lib/mock-data";

const navigation = [
  ["home", "#top"],
  ["courts", "/courts"],
  ["teams", "/teams"],
  ["maintenance", "#maintenance"],
  ["profile", "#profile"],
] as const;

export function Dashboard() {
  const [language, setLanguage] = useState<DashboardLanguage>("th");
  const copy = dashboardTranslations[language];
  const currentGames = games.filter((game) => game.status !== "COMPLETED");
  const completedGames = games.filter((game) => game.status === "COMPLETED");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("meq-language");
    if (savedLanguage !== "th" && savedLanguage !== "en") return;
    const frame = window.requestAnimationFrame(() => {
      setLanguage(savedLanguage);
      document.documentElement.lang = savedLanguage;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function selectLanguage(nextLanguage: DashboardLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("meq-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
  }

  return (
    <div className="app-frame" id="top">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label={`MeQ — ${copy.home}`}>
            <span className="brand-wordmark">MeQ</span>
            <span className="brand-context">{copy.university}</span>
          </a>
          <nav className="desktop-nav" aria-label={copy.mainNavigation}>
            {navigation.slice(0, 4).map(([label, href]) => <a key={label} href={href}>{copy[label]}</a>)}
          </nav>
          <div className="header-tools">
            <div className="language-switcher" aria-label={copy.switchLanguage} role="group">
              <button className={language === "th" ? "is-active" : ""} onClick={() => selectLanguage("th")} type="button" aria-pressed={language === "th"}>TH</button>
              <button className={language === "en" ? "is-active" : ""} onClick={() => selectLanguage("en")} type="button" aria-pressed={language === "en"}>EN</button>
            </div>
            <button className="profile-button" id="profile" type="button" aria-label={copy.profile}>
              <span aria-hidden="true">NU</span><span className="profile-label">{copy.profileName}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="status-strip" aria-labelledby="facility-status-heading">
          <div className="status-lead">
            <span className="status-indicator" aria-hidden="true" />
            <div><p className="section-label">{copy.facilityStatus}</p><h1 id="facility-status-heading">{copy.allCourtsOpen}</h1></div>
          </div>
          <dl className="status-facts">
            <div><dt>{copy.operatingHours}</dt><dd>05:00–24:00</dd></div>
            <div><dt>3x3 · {copy.todayScore}</dt><dd>7 <small>{copy.points}</small></dd></div>
            <div><dt>5x5 · {copy.todayScore}</dt><dd>15 <small>{copy.points}</small></dd></div>
          </dl>
        </section>

        <section id="courts" className="dashboard-section">
          <div className="section-heading"><div><p className="section-label">COURTS / 03</p><h2>{copy.courtOverview}</h2></div><p>{copy.courtOverviewHint}</p></div>
          <div className="court-grid">{courts.map((court) => <CourtCard key={court.id} court={court} copy={copy} />)}</div>
        </section>

        <div className="dashboard-grid">
          <section className="dashboard-section live-section" aria-labelledby="live-heading">
            <div className="section-heading compact"><div><p className="section-label">GAMES / {String(currentGames.length).padStart(2, "0")}</p><h2 id="live-heading">{copy.liveMatches}</h2></div><p>{copy.liveMatchesHint}</p></div>
            <div className="live-list">
              {currentGames.map((game) => (
                <article className={`live-scoreboard game-${game.status.toLowerCase()}`} key={game.id}>
                  <div className="scoreboard-meta"><span className="live-badge"><i />{game.status === "PLAYING" ? copy.live : copy.awaitingScore}</span><strong>{game.court}</strong><span>{copy.target} {game.targetScore} {copy.points}</span></div>
                  <div className="matchup-row"><strong>{game.home}</strong><b>VS</b><strong>{game.away}</strong></div>
                  {game.status === "PLAYING" && game.consecutiveWins ? <p className="streak-note">{game.continuingTeam} · {copy.consecutiveWins} {game.consecutiveWins}/2</p> : null}
                  {game.status === "AWAITING_SCORE" ? <p className="awaiting-note">{copy.awaitingScoreHint}</p> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-section actions-section" id="actions" aria-labelledby="actions-heading">
            <div className="section-heading compact"><div><p className="section-label">SERVICES</p><h2 id="actions-heading">{copy.quickActions}</h2></div><p>{copy.quickActionsHint}</p></div>
            <div className="quick-actions">
              <Link className="quick-action action-create" href="/teams/create"><span className="action-icon">＋</span><span><strong>{copy.createTeam}</strong><small>{copy.createTeamHint}</small></span><b className="action-arrow">→</b></Link>
              <Link className="quick-action action-team" href="/teams"><span className="action-icon">03</span><span><strong>{copy.myTeam}</strong><small>{copy.myTeamHint}</small></span><b className="action-arrow">→</b></Link>
              <button className="quick-action action-repair" type="button" id="maintenance"><span className="action-icon">!</span><span><strong>{copy.reportIssue}</strong><small>{copy.reportIssueHint}</small></span><b className="action-arrow">→</b></button>
            </div>
          </section>
        </div>

        <section className="dashboard-section stats-section" aria-labelledby="stats-heading">
          <div className="section-heading"><div><p className="section-label">PLAYER STATS</p><h2 id="stats-heading">{copy.myStats}</h2></div><p>{copy.myStatsHint}</p></div>
          <div className="stats-card">
            <dl className="stats-grid">
              <div><dt>{copy.totalGames}</dt><dd>{playerStats.totalGames}</dd></div>
              <div className="stat-win"><dt>{copy.wins}</dt><dd>{playerStats.wins}</dd></div>
              <div><dt>{copy.losses}</dt><dd>{playerStats.losses}</dd></div>
              <div className="stat-highlight"><dt>{copy.winRate}</dt><dd>{playerStats.winRate}%</dd></div>
              <div><dt>{copy.totalPoints}</dt><dd>{playerStats.totalPoints}</dd></div>
              <div><dt>{copy.averagePoints}</dt><dd>{playerStats.averagePoints}</dd></div>
            </dl>
            <button className="stats-button" type="button">{copy.viewAllStats}<b>→</b></button>
          </div>
        </section>

        <section className="dashboard-section results-section" aria-labelledby="results-heading">
          <div className="section-heading"><div><p className="section-label">COMPLETED / {String(completedGames.length).padStart(2, "0")}</p><h2 id="results-heading">{copy.recentResults}</h2></div><p>{copy.recentResultsHint}</p></div>
          <div className="results-list">
            {completedGames.map((game) => (
              <article className="result-card" key={game.id}>
                <div className="result-meta"><strong>{game.court}</strong><span>{copy.finishedAt} {game.completedAt}</span></div>
                <div className="result-score"><span>{game.home}</span><strong>{game.homeScore}</strong><b>:</b><strong>{game.awayScore}</strong><span>{game.away}</span></div>
                <p><span>{copy.winner}</span><strong>{game.winner}</strong></p>
              </article>
            ))}
          </div>
        </section>

        <CalendarPreview copy={copy} language={language} />
      </main>

      <nav className="bottom-nav" aria-label={copy.mainNavigation}>
        {navigation.map(([label, href], index) => <a key={label} href={href} className={index === 0 ? "is-active" : ""}><span aria-hidden="true">{["⌂", "▱", "◫", "!", "●"][index]}</span>{copy[label]}</a>)}
      </nav>
    </div>
  );
}
