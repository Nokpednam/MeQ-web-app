"use client";

import { QueueProvider } from "@/components/queue-provider";
import { TeamProvider } from "@/components/team-provider";
import { CheckInProvider } from "@/components/check-in-provider";
import { GameLifecycleProvider } from "@/components/game-lifecycle-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <TeamProvider><QueueProvider><CheckInProvider><GameLifecycleProvider>{children}</GameLifecycleProvider></CheckInProvider></QueueProvider></TeamProvider>;
}
