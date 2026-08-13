import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TeamDetailView } from "@/components/supabase-team-views";
import { createClient } from "@/lib/supabase/server";
import { getTeamById } from "@/lib/supabase-team-repository";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/teams/${teamId}`);
  return <Suspense><TeamDetailView data={await getTeamById(supabase, teamId, user.id)} /></Suspense>;
}
