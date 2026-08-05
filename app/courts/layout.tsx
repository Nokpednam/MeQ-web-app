import { CourtShell } from "@/components/court-shell";

export default function CourtsLayout({ children }: { children: React.ReactNode }) {
  return <CourtShell>{children}</CourtShell>;
}
