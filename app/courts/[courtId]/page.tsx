import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { SupabaseCheckInSection, SupabaseCourtDetailView } from "@/components/supabase-court-views";
import { PublicMaintenanceBoard } from "@/components/public-maintenance-board";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseQueueData } from "@/lib/supabase-queue-repository";
import { getPublicMaintenanceReports } from "@/lib/supabase-maintenance-repository";
import { isCourtId } from "@/lib/court-data";

export default async function CourtPage({params}:{params:Promise<{courtId:string}>}) {
  const { courtId } = await params;
  if (!isCourtId(courtId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/courts/${courtId}`);
  const [data, maintenanceReports] = await Promise.all([getSupabaseQueueData(supabase,user.id),getPublicMaintenanceReports(supabase)]);
  return <Suspense><div className="court-page"><PublicMaintenanceBoard reports={maintenanceReports} courtId={courtId} compact/></div><SupabaseCourtDetailView data={data} courtId={courtId}/><SupabaseCheckInSection data={data} courtId={courtId}/></Suspense>;
}
