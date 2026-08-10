"use client";

import Link from "next/link";
import { dashboardTranslations, teamTranslations } from "@/lib/dashboard-translations";
import { useMeqLanguage } from "@/components/use-meq-language";
import { useTeamData } from "@/components/team-provider";

export function TeamShell({ children }: { children: React.ReactNode }) {
  const { language, selectLanguage } = useMeqLanguage();
  const dashboardCopy = dashboardTranslations[language];
  const copy = teamTranslations[language];
  const { currentUser, resetMockData } = useTeamData();

  return (
    <div className="app-frame team-app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label={`MeQ — ${dashboardCopy.home}`}>
            <span className="brand-wordmark">MeQ</span>
            <span className="brand-context">{dashboardCopy.university}</span>
          </Link>
          <nav className="desktop-nav" aria-label={dashboardCopy.mainNavigation}>
            <Link href="/">{dashboardCopy.home}</Link>
            <Link href="/courts">{dashboardCopy.courts}</Link>
            <Link className="nav-current" href="/teams">{dashboardCopy.teams}</Link>
            <Link href="/#maintenance">{dashboardCopy.maintenance}</Link>
          </nav>
          <div className="header-tools">
            <div className="language-switcher" aria-label={dashboardCopy.switchLanguage} role="group">
              <button className={language === "th" ? "is-active" : ""} onClick={() => selectLanguage("th")} type="button" aria-pressed={language === "th"}>TH</button>
              <button className={language === "en" ? "is-active" : ""} onClick={() => selectLanguage("en")} type="button" aria-pressed={language === "en"}>EN</button>
            </div>
            <Link className="profile-button" href="/profile" aria-label={dashboardCopy.profile}>
              <span aria-hidden="true">{currentUser?.initials ?? "NU"}</span><span className="profile-label">{currentUser?.displayName ?? dashboardCopy.profileName}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="team-shell">
        <div className="mock-banner" role="note">
          <span>DEV</span>
          <div><strong>{copy.mockData}</strong><small>{copy.mockDataHint}</small></div>
          {process.env.NODE_ENV === "development" ? <button type="button" onClick={resetMockData}>{copy.resetMock}</button> : null}
        </div>
        {children}
      </main>

      <nav className="bottom-nav" aria-label={dashboardCopy.mainNavigation}>
        <Link href="/"><span aria-hidden="true">⌂</span>{dashboardCopy.home}</Link>
        <Link href="/courts"><span aria-hidden="true">▱</span>{dashboardCopy.courts}</Link>
        <Link className="is-active" href="/teams"><span aria-hidden="true">◫</span>{dashboardCopy.teams}</Link>
        <Link href="/#maintenance"><span aria-hidden="true">!</span>{dashboardCopy.maintenance}</Link>
        <Link href="/profile"><span aria-hidden="true">●</span>{dashboardCopy.profile}</Link>
      </nav>
    </div>
  );
}
