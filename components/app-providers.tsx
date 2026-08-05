"use client";

import { QueueProvider } from "@/components/queue-provider";
import { TeamProvider } from "@/components/team-provider";
import { CheckInProvider } from "@/components/check-in-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <TeamProvider><QueueProvider><CheckInProvider>{children}</CheckInProvider></QueueProvider></TeamProvider>;
}
