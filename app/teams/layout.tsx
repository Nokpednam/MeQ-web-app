import { redirect } from "next/navigation";
import { TeamShell } from "@/components/team-shell";
import { createClient } from "@/lib/supabase/server";
import { getTeamPageData } from "@/lib/supabase-team-repository";

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/teams");
  const { currentUser } = await getTeamPageData(supabase, user.id);
  return <TeamShell profile={currentUser}>{children}</TeamShell>;
}
