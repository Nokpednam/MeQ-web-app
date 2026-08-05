import { TeamProvider } from "@/components/team-provider";
import { TeamShell } from "@/components/team-shell";

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return <TeamProvider><TeamShell>{children}</TeamShell></TeamProvider>;
}
