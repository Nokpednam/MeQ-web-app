"use client";
import Link from "next/link";
import { AdminEventsSection } from "./admin-events-section";
import { useMeqLanguage } from "./use-meq-language";
import { adminTranslations } from "@/lib/admin-translations";
import type { AdminEventRow, SupabaseAdminData } from "@/lib/supabase-admin-repository";

export function AdminEventsPage({ events, courts }: { events: AdminEventRow[]; courts: SupabaseAdminData["courts"] }) {
  const { language } = useMeqLanguage();
  const copy = adminTranslations[language];
  return <main className="admin-shell">
    <header className="admin-header"><div><p className="section-label">CALENDAR</p><h1>{copy.allEventsTitle}</h1><p>{copy.allEventsSubtitle}</p></div><div className="admin-header-actions"><Link className="queue-secondary-button" href="/admin">← {copy.backToAdmin}</Link></div></header>
    <AdminEventsSection events={events} courts={courts} preview={false}/>
  </main>;
}
