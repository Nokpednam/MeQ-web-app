import { redirect } from "next/navigation";
import { TeamHomeView } from "@/components/supabase-team-views";
import { createClient } from "@/lib/supabase/server";
import { getTeamPageData } from "@/lib/supabase-team-repository";

export default async function TeamsPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/teams");
  return <TeamHomeView data={await getTeamPageData(supabase, user.id)} />;
}
