import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CreateTeamView } from "@/components/supabase-team-views";
import { createClient } from "@/lib/supabase/server";
import { getTeamPageData } from "@/lib/supabase-team-repository";

export default async function CreateTeamPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/teams/create");
  const data = await getTeamPageData(supabase, user.id);
  if (data.currentTeam) redirect(`/teams/${data.currentTeam.id}?notice=already-member`);
  return <Suspense><CreateTeamView /></Suspense>;
}
