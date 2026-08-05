"use client";

import Link from "next/link";
import { dashboardTranslations, queueTranslations } from "@/lib/dashboard-translations";
import { useMeqLanguage } from "@/components/use-meq-language";
import { useQueueData } from "@/components/queue-provider";
import { useTeamData } from "@/components/team-provider";
import { NotificationCenter } from "@/components/notification-center";

export function CourtShell({ children }: { children: React.ReactNode }) {
  const { language, selectLanguage } = useMeqLanguage();
  const dashboardCopy = dashboardTranslations[language];
  const copy = queueTranslations[language];
  const { currentUser } = useTeamData();
  const { resetQueueData } = useQueueData();

  return (
    <div className="app-frame court-app">
      <header className="topbar"><div className="topbar-inner">
        <Link className="brand" href="/"><span className="brand-wordmark">MeQ</span><span className="brand-context">{dashboardCopy.university}</span></Link>
        <nav className="desktop-nav" aria-label={dashboardCopy.mainNavigation}>
          <Link href="/">{dashboardCopy.home}</Link><Link className="nav-current" href="/courts">{dashboardCopy.courts}</Link><Link href="/teams">{dashboardCopy.teams}</Link><Link href="/#maintenance">{dashboardCopy.maintenance}</Link>
        </nav>
        <div className="header-tools"><div className="language-switcher" aria-label={dashboardCopy.switchLanguage} role="group"><button className={language === "th" ? "is-active" : ""} onClick={() => selectLanguage("th")} type="button">TH</button><button className={language === "en" ? "is-active" : ""} onClick={() => selectLanguage("en")} type="button">EN</button></div><button className="profile-button" type="button"><span>{currentUser?.initials ?? "NU"}</span><span className="profile-label">{currentUser?.displayName ?? dashboardCopy.profileName}</span></button></div>
      </div></header>
      <main className="court-shell"><div className="court-tools-row"><div className="mock-banner" role="note"><span>DEV</span><div><strong>{copy.mockData}</strong><small>{copy.mockLocationHint}</small></div>{process.env.NODE_ENV === "development" ? <button type="button" onClick={resetQueueData}>{copy.resetQueue}</button> : null}</div><NotificationCenter /></div>{children}</main>
      <nav className="bottom-nav" aria-label={dashboardCopy.mainNavigation}><Link href="/"><span>⌂</span>{dashboardCopy.home}</Link><Link className="is-active" href="/courts"><span>▱</span>{dashboardCopy.courts}</Link><Link href="/teams"><span>◫</span>{dashboardCopy.teams}</Link><Link href="/#maintenance"><span>!</span>{dashboardCopy.maintenance}</Link><Link href="/"><span>●</span>{dashboardCopy.profile}</Link></nav>
    </div>
  );
}
