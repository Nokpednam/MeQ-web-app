import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TeamDetailView } from "@/components/supabase-team-views";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getTeamById } from "@/lib/supabase-team-repository";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect(`/login?next=/teams/${teamId}`);
  return <Suspense><TeamDetailView data={await getTeamById(supabase, teamId, user.id)} /></Suspense>;
}
