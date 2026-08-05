import { Suspense } from "react";
import { TeamDetailClient } from "@/components/team-detail-client";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <Suspense><TeamDetailClient teamId={teamId} /></Suspense>;
}
