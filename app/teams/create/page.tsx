import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CreateTeamView } from "@/components/supabase-team-views";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCachedTeamPageData } from "@/lib/supabase-team-repository";

export default async function CreateTeamPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/teams/create");
  const data = await getCachedTeamPageData(supabase, user.id);
  if (data.currentTeam) redirect(`/teams/${data.currentTeam.id}?notice=already-member`);
  return <Suspense><CreateTeamView /></Suspense>;
}
