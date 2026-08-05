"use client";

import { QueueProvider } from "@/components/queue-provider";
import { TeamProvider } from "@/components/team-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <TeamProvider><QueueProvider>{children}</QueueProvider></TeamProvider>;
}
