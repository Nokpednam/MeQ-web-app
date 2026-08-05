import { CourtDetailClient } from "@/components/court-detail-client";

export default async function CourtDetailPage({ params }: { params: Promise<{ courtId: string }> }) {
  const { courtId } = await params;
  return <CourtDetailClient courtId={courtId} />;
}
