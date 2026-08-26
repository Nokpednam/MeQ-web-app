"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarPreview } from "@/components/calendar-preview";
import { CourtCard } from "@/components/court-card";
import {
  dashboardTranslations,
  type DashboardLanguage,
} from "@/lib/dashboard-translations";
import { gameTranslations } from "@/lib/game-translations";
import {
  getActiveGameForCourt,
  isGameActive,
} from "@/lib/game-lifecycle-rules";
import type { SupabaseDashboardData } from "@/lib/supabase-dashboard-repository";
import type { CourtView, PlayerStatsView } from "@/lib/mock-data";

const navigation = [
  ["home", "#top"],
  ["courts", "/courts"],
  ["teams", "/teams"],
  ["maintenance", "/maintenance/new"],
  ["profile", "/profile"],
] as const;

function getLocalDateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyStats: PlayerStatsView = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  totalPoints: 0,
  averagePoints: 0,
  highestScoreInGame: 0,
};

export function Dashboard({ data }: { data: SupabaseDashboardData }) {
  const [language, setLanguage] = useState<DashboardLanguage>("th");
  const [showAllResults, setShowAllResults] = useState(false);
  const [selectedResultDate, setSelectedResultDate] = useState("");
  const [showAllStats, setShowAllStats] = useState(false);
  const copy = dashboardTranslations[language];
  const gameCopy = gameTranslations[language];
  const activeGames = data.games.filter(isGameActive);
  const completedGames = data.games
    .filter((game) => game.status === "COMPLETED")
    .sort(
      (a, b) =>
        Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? ""),
    );
  const gamesOnSelectedDate = selectedResultDate
    ? completedGames.filter(
        (game) => getLocalDateKey(game.completedAt) === selectedResultDate,
      )
    : completedGames;
  const visibleCompletedGames =
    selectedResultDate || showAllResults
      ? gamesOnSelectedDate
      : gamesOnSelectedDate.slice(0, 2);
  const lifecycleHistory = data.history;
  const lifecycleWins = lifecycleHistory.filter((item) => item.won).length;
  const computedStats = lifecycleHistory.length
    ? {
        totalGames: lifecycleHistory.length,
        wins: lifecycleWins,
        losses: lifecycleHistory.length - lifecycleWins,
        winRate: Math.round((lifecycleWins / lifecycleHistory.length) * 100),
        totalPoints: lifecycleHistory.reduce(
          (sum, item) => sum + item.points,
          0,
        ),
        averagePoints: Number(
          (
            lifecycleHistory.reduce((sum, item) => sum + item.points, 0) /
            lifecycleHistory.length
          ).toFixed(1),
        ),
        highestScoreInGame: Math.max(
          ...lifecycleHistory.map((item) => item.points),
        ),
      }
    : emptyStats;
  const formatStats = (["THREE_X_THREE", "FIVE_X_FIVE"] as const).map(
    (teamType) => {
      const games = lifecycleHistory.filter(
        (item) => item.teamType === teamType,
      );
      const wins = games.filter((item) => item.won).length;
      const totalPoints = games.reduce((sum, item) => sum + item.points, 0);
      return {
        teamType,
        label: teamType === "THREE_X_THREE" ? "3x3" : "5x5",
        totalGames: games.length,
        wins,
        losses: games.length - wins,
        winRate: games.length ? Math.round((wins / games.length) * 100) : 0,
        totalPoints,
        averagePoints: games.length
          ? Number((totalPoints / games.length).toFixed(1))
          : 0,
        highestScoreInGame: games.length
          ? Math.max(...games.map((item) => item.points))
          : 0,
      };
    },
  );
  const dashboardCourts: CourtView[] = data.queue.courts.map((court) => ({
    id: court.id,
    name: court.name,
    type: court.type,
    image: court.image,
    status: court.isOpen ? "OPEN" : "CLOSED",
    targetScore: court.targetScore,
    queue: [],
  }));

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
            {navigation.slice(0, 4).map(([label, href]) => (
              <a key={label} href={href} className={href === "#top" ? "nav-current" : undefined}>
                {copy[label]}
              </a>
            ))}
          </nav>
          <div className="header-tools">
            {data.profile.role === "ADMIN" ? (
              <Link className="admin-entry" href="/admin">
                {copy.adminCenter}
              </Link>
            ) : null}
            <div
              className="language-switcher"
              aria-label={copy.switchLanguage}
              role="group"
            >
              <button
                className={language === "th" ? "is-active" : ""}
                onClick={() => selectLanguage("th")}
                type="button"
                aria-pressed={language === "th"}
              >
                TH
              </button>
              <button
                className={language === "en" ? "is-active" : ""}
                onClick={() => selectLanguage("en")}
                type="button"
                aria-pressed={language === "en"}
              >
                EN
              </button>
            </div>
            <Link
              className="profile-button"
              href="/profile"
              aria-label={copy.profile}
            >
              <span aria-hidden="true">
                {data.profile.avatarUrl ? (
                  <Image
                    src={data.profile.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                  />
                ) : (
                  data.profile.initials
                )}
              </span>
              <span className="profile-label">{data.profile.displayName}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="dashboard-shell">
        <section
          className="status-strip"
          aria-labelledby="facility-status-heading"
        >
          <div className="status-lead">
            <span className="status-indicator" aria-hidden="true" />
            <div>
              <p className="section-label">{copy.facilityStatus}</p>
              <h1 id="facility-status-heading">{copy.allCourtsOpen}</h1>
            </div>
          </div>
          <dl className="status-facts">
            <div>
              <dt>{copy.operatingHours}</dt>
              <dd>05:00–00:00</dd>
            </div>
            <div>
              <dt>3x3 · {copy.todayScore}</dt>
              <dd>
                7 <small>{copy.points}</small>
              </dd>
            </div>
            <div>
              <dt>5x5 · {copy.todayScore}</dt>
              <dd>
                15 <small>{copy.points}</small>
              </dd>
            </div>
          </dl>
        </section>
        <section id="courts" className="dashboard-section">
          <div className="section-heading">
            <div>
              <p className="section-label">COURTS / 03</p>
              <h2>{copy.courtOverview}</h2>
            </div>
            <p>{copy.courtOverviewHint}</p>
          </div>
          <div className="court-grid">
            {dashboardCourts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                copy={copy}
                activeGame={getActiveGameForCourt(
                  data.games,
                  court.id as "3x3-a" | "3x3-b" | "5x5",
                )}
                queueCount={
                  data.queue.entries.filter(
                    (entry) =>
                      entry.courtId === court.id && entry.status === "WAITING",
                  ).length
                }
              />
            ))}
          </div>
        </section>

        <div className="dashboard-grid">
          <section
            className="dashboard-section live-section"
            aria-labelledby="live-heading"
          >
            <div className="section-heading compact">
              <div>
                <p className="section-label">
                  GAMES / {String(activeGames.length).padStart(2, "0")}
                </p>
                <h2 id="live-heading">{copy.liveMatches}</h2>
              </div>
              <p>{copy.liveMatchesHint}</p>
            </div>
            <div className="live-list">
              {activeGames.map((game) => (
                <Link
                  href={`/games/${game.id}`}
                  className="live-scoreboard game-playing"
                  key={game.id}
                >
                  <div className="scoreboard-meta">
                    <span className="live-badge">
                      <i />
                      {
                        gameCopy[
                          `status_${game.status}` as keyof typeof gameCopy
                        ]
                      }
                    </span>
                    <strong>{game.courtId.toUpperCase()}</strong>
                    <span>
                      {gameCopy.target} {game.targetScore} {gameCopy.points}
                    </span>
                  </div>
                  <div className="matchup-row">
                    <strong>{game.teamA.teamName}</strong>
                    <b>VS</b>
                    <strong>{game.teamB.teamName}</strong>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section
            className="dashboard-section actions-section"
            id="actions"
            aria-labelledby="actions-heading"
          >
            <div className="section-heading compact">
              <div>
                <p className="section-label">SERVICES</p>
                <h2 id="actions-heading">{copy.quickActions}</h2>
              </div>
              <p>{copy.quickActionsHint}</p>
            </div>
            <div className="quick-actions">
              <Link className="quick-action action-create" href="/teams/create">
                <span className="action-icon">＋</span>
                <span>
                  <strong>{copy.createTeam}</strong>
                  <small>{copy.createTeamHint}</small>
                </span>
                <b className="action-arrow">→</b>
              </Link>
              <Link className="quick-action action-team" href="/teams">
                <span className="action-icon">03</span>
                <span>
                  <strong>{copy.myTeam}</strong>
                  <small>{copy.myTeamHint}</small>
                </span>
                <b className="action-arrow">→</b>
              </Link>
              <Link
                className="quick-action action-repair"
                href="/maintenance/new"
                id="maintenance"
              >
                <span className="action-icon">!</span>
                <span>
                  <strong>{copy.reportIssue}</strong>
                  <small>{copy.reportIssueHint}</small>
                </span>
                <b className="action-arrow">→</b>
              </Link>
            </div>
          </section>
        </div>

        <section
          className="dashboard-section stats-section"
          aria-labelledby="stats-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-label">PLAYER STATS</p>
              <h2 id="stats-heading">{copy.myStats}</h2>
            </div>
            <p>{copy.myStatsHint}</p>
          </div>
          <div className="stats-card">
            <dl className="stats-grid">
              <div>
                <dt>{copy.totalGames}</dt>
                <dd>{computedStats.totalGames}</dd>
              </div>
              <div className="stat-win">
                <dt>{copy.wins}</dt>
                <dd>{computedStats.wins}</dd>
              </div>
              <div>
                <dt>{copy.losses}</dt>
                <dd>{computedStats.losses}</dd>
              </div>
              <div className="stat-highlight">
                <dt>{copy.winRate}</dt>
                <dd>{computedStats.winRate}%</dd>
              </div>
            </dl>
            <div className="format-stats" aria-label={copy.statsByFormat}>
              <h3>{copy.statsByFormat}</h3>
              <div className="format-stats-grid">
                {formatStats.map((stats) => (
                  <article
                    className={`format-stat-card format-${stats.teamType.toLowerCase()}`}
                    key={stats.teamType}
                  >
                    <header>
                      <strong>{stats.label}</strong>
                      <span>
                        {stats.totalGames} {copy.gamesUnit}
                      </span>
                    </header>
                    <dl>
                      <div>
                        <dt>{copy.record}</dt>
                        <dd>
                          <b>{stats.wins}</b>–{stats.losses}
                        </dd>
                      </div>
                      <div>
                        <dt>{copy.winRate}</dt>
                        <dd>{stats.winRate}%</dd>
                      </div>
                      <div>
                        <dt>{copy.totalPoints}</dt>
                        <dd>{stats.totalPoints}</dd>
                      </div>
                      <div>
                        <dt>{copy.averagePoints}</dt>
                        <dd>{stats.averagePoints}</dd>
                      </div>
                      <div>
                        <dt>{copy.highestScoreInGame}</dt>
                        <dd>{stats.highestScoreInGame}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </div>
            {showAllStats ? (
              <div className="stats-history">
                <h3>{copy.matchHistory}</h3>
                {lifecycleHistory.length ? (
                  <ol>
                    {[...lifecycleHistory]
                      .sort(
                        (a, b) =>
                          Date.parse(b.completedAt) - Date.parse(a.completedAt),
                      )
                      .map((item) => (
                        <li key={`${item.gameId}-${item.playerId}`}>
                          <Link href={`/games/${item.gameId}/result`}>
                            <div>
                              <strong>
                                {item.teamType === "THREE_X_THREE"
                                  ? "3x3"
                                  : "5x5"}
                              </strong>
                              <time>
                                {new Date(item.completedAt).toLocaleDateString(
                                  language === "th" ? "th-TH" : "en-GB",
                                )}
                              </time>
                            </div>
                            <span className={item.won ? "is-win" : "is-loss"}>
                              {item.won ? copy.wonLabel : copy.lostLabel}
                            </span>
                            <b>
                              {item.points} {copy.pointsScored}
                            </b>
                            <i>→</i>
                          </Link>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p>{copy.noStatsHistory}</p>
                )}
              </div>
            ) : null}
            <button
              className="stats-button"
              type="button"
              aria-expanded={showAllStats}
              onClick={() => setShowAllStats((value) => !value)}
            >
              {showAllStats ? copy.showLessStats : copy.viewAllStats}
              <b>{showAllStats ? "↑" : "→"}</b>
            </button>
          </div>
        </section>

        <section
          className="dashboard-section results-section"
          aria-labelledby="results-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-label">
                COMPLETED / {String(completedGames.length).padStart(2, "0")}
              </p>
              <h2 id="results-heading">{copy.recentResults}</h2>
            </div>
            <p>{copy.recentResultsHint}</p>
          </div>
          <div className="results-filter">
            <label htmlFor="result-date">{copy.selectResultDate}</label>
            <input
              id="result-date"
              type="date"
              value={selectedResultDate}
              onInput={(event) =>
                setSelectedResultDate(event.currentTarget.value)
              }
            />
            {selectedResultDate ? (
              <button type="button" onClick={() => setSelectedResultDate("")}>
                {copy.clearResultDate}
              </button>
            ) : null}
          </div>
          <div className="results-list">
            {visibleCompletedGames.map((game) => (
              <Link
                href={`/games/${game.id}/result`}
                className="result-card"
                key={game.id}
              >
                <div className="result-meta">
                  <strong>{game.courtId.toUpperCase()}</strong>
                  <span>
                    {copy.finishedAt}{" "}
                    {game.completedAt
                      ? new Date(game.completedAt).toLocaleTimeString()
                      : ""}{" "}
                    · {copy.target} {game.targetScore}
                  </span>
                </div>
                <div className="result-score">
                  <span>{game.teamA.teamName}</span>
                  <strong>{game.finalTeamAScore}</strong>
                  <b>:</b>
                  <strong>{game.finalTeamBScore}</strong>
                  <span>{game.teamB.teamName}</span>
                </div>
                <p>
                  <span>{copy.winner}</span>
                  <strong>
                    {game.winnerTeamId === game.teamA.teamId
                      ? game.teamA.teamName
                      : game.teamB.teamName}
                  </strong>
                </p>
              </Link>
            ))}
          </div>
          {selectedResultDate && visibleCompletedGames.length === 0 ? (
            <p className="results-empty" role="status">
              {copy.noResultsOnDate}
            </p>
          ) : null}
          {!selectedResultDate && completedGames.length > 2 ? (
            <div className="results-toggle">
              <button
                className="stats-button"
                type="button"
                aria-expanded={showAllResults}
                onClick={() => setShowAllResults((value) => !value)}
              >
                {showAllResults ? copy.showLessResults : copy.viewAllResults}
                <b>{showAllResults ? "↑" : "→"}</b>
              </button>
            </div>
          ) : null}
        </section>

        <CalendarPreview copy={copy} language={language} events={data.events} />
      </main>

      <nav className="bottom-nav" aria-label={copy.mainNavigation}>
        {navigation.map(([label, href], index) => (
          <a key={label} href={href} className={index === 0 ? "is-active" : ""}>
            <span aria-hidden="true">{["⌂", "▱", "◫", "!", "●"][index]}</span>
            {copy[label]}
          </a>
        ))}
      </nav>
    </div>
  );
}
