import { TeamShell } from "@/components/team-shell";

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return <TeamShell>{children}</TeamShell>;
}
