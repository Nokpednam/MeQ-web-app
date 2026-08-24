import { redirect } from "next/navigation";
import { TeamHomeView } from "@/components/supabase-team-views";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCachedTeamPageData } from "@/lib/supabase-team-repository";

export default async function TeamsPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/teams");
  return <TeamHomeView data={await getCachedTeamPageData(supabase, user.id)} />;
}
