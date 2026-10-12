import type { Metadata } from "next";
import { Suspense } from "react";
import { UserAlerts } from "@/components/user-alerts";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getUserAlerts } from "@/lib/supabase-user-alerts-repository";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeQ | สนามบาส มหาวิทยาลัยนเรศวร",
  description: "แดชบอร์ดคิวสนามบาสและแจ้งซ่อม มหาวิทยาลัยนเรศวร",
};

async function UserAlertsSlot() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return null;
  return <UserAlerts alerts={await getUserAlerts(supabase, user.id)} />;
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <Suspense fallback={null}><UserAlertsSlot /></Suspense>
        {children}
      </body>
    </html>
  );
}
