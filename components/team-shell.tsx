"use client";

import Link from "next/link";
import { dashboardTranslations } from "@/lib/dashboard-translations";
import { useMeqLanguage } from "@/components/use-meq-language";
import type { AuthTeamProfile } from "@/lib/supabase-team-repository";

export function TeamShell({ children, profile }: { children: React.ReactNode; profile: AuthTeamProfile }) {
  const { language, selectLanguage } = useMeqLanguage();
  const dashboardCopy = dashboardTranslations[language];
  return <div className="app-frame team-app">
    <header className="topbar"><div className="topbar-inner">
      <Link className="brand" href="/"><span className="brand-wordmark">MeQ</span><span className="brand-context">{dashboardCopy.university}</span></Link>
      <nav className="desktop-nav" aria-label={dashboardCopy.mainNavigation}><Link href="/">{dashboardCopy.home}</Link><Link href="/courts">{dashboardCopy.courts}</Link><Link className="nav-current" href="/teams">{dashboardCopy.teams}</Link><Link href="/maintenance">{dashboardCopy.maintenance}</Link></nav>
      <div className="header-tools"><div className="language-switcher" role="group" aria-label={dashboardCopy.switchLanguage}><button className={language === "th" ? "is-active" : ""} onClick={() => selectLanguage("th")}>TH</button><button className={language === "en" ? "is-active" : ""} onClick={() => selectLanguage("en")}>EN</button></div><Link className="profile-button" href="/profile"><span>{profile.initials}</span><span className="profile-label">{profile.displayName}</span></Link></div>
    </div></header>
    <main className="team-shell"><div className="mock-banner" role="note"><span>DB</span><div><strong>{language === "th" ? "ข้อมูลทีมจริง" : "Live team data"}</strong><small>{language === "th" ? "บันทึกอย่างปลอดภัยใน Supabase" : "Securely saved in Supabase"}</small></div></div>{children}</main>
    <nav className="bottom-nav" aria-label={dashboardCopy.mainNavigation}><Link href="/"><span>⌂</span>{dashboardCopy.home}</Link><Link href="/courts"><span>▱</span>{dashboardCopy.courts}</Link><Link className="is-active" href="/teams"><span>◫</span>{dashboardCopy.teams}</Link><Link href="/maintenance"><span>!</span>{dashboardCopy.maintenance}</Link><Link href="/profile"><span>●</span>{dashboardCopy.profile}</Link></nav>
  </div>;
}
