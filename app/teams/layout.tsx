import { redirect } from "next/navigation";
import { TeamShell } from "@/components/team-shell";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCachedTeamPageData } from "@/lib/supabase-team-repository";

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/teams");
  const { currentUser } = await getCachedTeamPageData(supabase, user.id);
  return <TeamShell profile={currentUser}>{children}</TeamShell>;
}
