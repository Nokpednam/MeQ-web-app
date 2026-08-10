"use client";

import Link from "next/link";
import { dashboardTranslations } from "@/lib/dashboard-translations";
import { profileTranslations } from "@/lib/profile-translations";
import { playerStats, playerStatsByFormat } from "@/lib/mock-data";
import { useGameLifecycle } from "./game-lifecycle-provider";
import { useMeqLanguage } from "./use-meq-language";
import { useTeamData } from "./team-provider";

export function ProfilePage() {
  const { language, selectLanguage } = useMeqLanguage();
  const dashboardCopy = dashboardTranslations[language];
  const copy = profileTranslations[language];
  const { currentUser, currentTeam } = useTeamData();
  const lifecycle = useGameLifecycle();
  const history = lifecycle.history.filter((item) => item.playerId === currentUser?.id).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
  const historyWins = history.filter((item) => item.won).length;
  const games = history.length || playerStats.totalGames;
  const wins = history.length ? historyWins : playerStats.wins;
  const winRate = history.length ? Math.round(historyWins/history.length*100) : playerStats.winRate;
  const losses = games - wins;
  const formatStats = (["THREE_X_THREE", "FIVE_X_FIVE"] as const).map((teamType) => {
    const formatHistory = history.filter((item) => item.teamType === teamType);
    if (!history.length) return { teamType, ...playerStatsByFormat[teamType] };
    const formatWins = formatHistory.filter((item) => item.won).length;
    const formatPoints = formatHistory.reduce((sum,item)=>sum+item.points,0);
    return { teamType, totalGames:formatHistory.length, wins:formatWins, losses:formatHistory.length-formatWins, winRate:formatHistory.length?Math.round(formatWins/formatHistory.length*100):0, totalPoints:formatPoints, averagePoints:formatHistory.length?Number((formatPoints/formatHistory.length).toFixed(1)):0, highestScoreInGame:formatHistory.length?Math.max(...formatHistory.map((item)=>item.points)):0 };
  });

  return <div className="app-frame profile-app">
    <header className="topbar"><div className="topbar-inner"><Link className="brand" href="/"><span className="brand-wordmark">MeQ</span><span className="brand-context">{dashboardCopy.university}</span></Link><nav className="desktop-nav" aria-label={dashboardCopy.mainNavigation}><Link href="/">{dashboardCopy.home}</Link><Link href="/courts">{dashboardCopy.courts}</Link><Link href="/teams">{dashboardCopy.teams}</Link><Link href="/#maintenance">{dashboardCopy.maintenance}</Link></nav><div className="header-tools"><div className="language-switcher" role="group" aria-label={dashboardCopy.switchLanguage}><button className={language==="th"?"is-active":""} onClick={()=>selectLanguage("th")}>TH</button><button className={language==="en"?"is-active":""} onClick={()=>selectLanguage("en")}>EN</button></div><span className="profile-button is-current"><span>{currentUser?.initials??"NU"}</span><span className="profile-label">{currentUser?.displayName??dashboardCopy.profileName}</span></span></div></div></header>
    <main className="profile-shell">
      <header className="profile-heading"><div><p className="section-label">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><Link href="/">← {copy.back}</Link></header>
      <div className="mock-banner profile-mock" role="note"><span>DEV</span><div><strong>{copy.mock}</strong><small>localStorage</small></div></div>
      <section className="profile-identity"><div className="profile-avatar-large">{currentUser?.initials??"NU"}</div><div><small>{dashboardCopy.profile}</small><h2>{currentUser?.displayName??dashboardCopy.profileName}</h2><p>{copy.team}: <strong>{currentTeam?.name??copy.noTeam}</strong></p></div>{currentTeam?<Link href={`/teams/${currentTeam.id}`}>{copy.manageTeam} →</Link>:<Link href="/teams/create">{dashboardCopy.createTeam} →</Link>}</section>
      <dl className="profile-stats"><div><dt>{copy.games}</dt><dd>{games}</dd></div><div><dt>{copy.wins}</dt><dd>{wins}</dd></div><div><dt>{copy.losses}</dt><dd>{losses}</dd></div><div><dt>{copy.winRate}</dt><dd>{winRate}%</dd></div></dl>
      <section className="profile-format-section"><div className="section-heading"><div><p className="section-label">3x3 / 5x5</p><h2>{copy.byFormat}</h2></div><p>{copy.byFormatHint}</p></div><div className="profile-format-grid">{formatStats.map((stats)=><article className={stats.teamType==="THREE_X_THREE"?"is-3x3":"is-5x5"} key={stats.teamType}><header><strong>{stats.teamType==="THREE_X_THREE"?"3x3":"5x5"}</strong><span>{stats.totalGames} {copy.games}</span></header><dl><div><dt>{copy.wins}–{copy.losses}</dt><dd>{stats.wins}–{stats.losses}</dd></div><div><dt>{copy.winRate}</dt><dd>{stats.winRate}%</dd></div><div><dt>{copy.points}</dt><dd>{stats.totalPoints}</dd></div><div><dt>{copy.average}</dt><dd>{stats.averagePoints}</dd></div><div><dt>{copy.highest}</dt><dd>{stats.highestScoreInGame}</dd></div></dl></article>)}</div></section>
      <section className="profile-history"><div className="section-heading"><div><p className="section-label">HISTORY</p><h2>{copy.recent}</h2></div></div>{history.length?<ol>{history.slice(0,5).map((item)=><li key={`${item.gameId}-${item.playerId}`}><Link href={`/games/${item.gameId}/result`}><span className={item.won?"is-win":"is-loss"}>{item.won?copy.won:copy.lost}</span><strong>{item.teamType==="THREE_X_THREE"?"3x3":"5x5"}</strong><time>{new Date(item.completedAt).toLocaleDateString(language==="th"?"th-TH":"en-GB")}</time><b>{item.points} {dashboardCopy.points}</b><i>→</i></Link></li>)}</ol>:<p className="empty-queue">{copy.noGames}</p>}</section>
    </main>
    <nav className="bottom-nav" aria-label={dashboardCopy.mainNavigation}><Link href="/"><span>⌂</span>{dashboardCopy.home}</Link><Link href="/courts"><span>▱</span>{dashboardCopy.courts}</Link><Link href="/teams"><span>◫</span>{dashboardCopy.teams}</Link><Link href="/#maintenance"><span>!</span>{dashboardCopy.maintenance}</Link><Link className="is-active" href="/profile"><span>●</span>{dashboardCopy.profile}</Link></nav>
  </div>;
}
