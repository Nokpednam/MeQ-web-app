"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CourtId } from "@/lib/queue-types";

function queueError(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("one_active_queue_per_team") || message.includes("active_queue_players")) return "ACTIVE_ON_OTHER_COURT";
  return message.match(/[A-Z][A-Z_]+/)?.[0] ?? "UNKNOWN_ERROR";
}

async function authenticatedClient(next: string) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return supabase;
}

function refreshQueue() { revalidatePath("/courts", "layout"); revalidatePath("/teams", "layout"); }

export async function joinCourtQueueAction(formData: FormData) {
  const courtId = String(formData.get("courtId")) as CourtId;
  if (!["3x3-a", "3x3-b", "5x5"].includes(courtId)) redirect("/courts?error=COURT_NOT_FOUND");
  const supabase = await authenticatedClient(`/courts/${courtId}`); const { error } = await supabase.rpc("join_court_queue", { p_court_id: courtId });
  refreshQueue(); redirect(`/courts/${courtId}${error ? `?error=${queueError(error)}` : "?notice=joined"}`);
}

export async function leaveCourtQueueAction(formData: FormData) {
  const courtId = String(formData.get("courtId")) as CourtId; const entryId = String(formData.get("entryId") ?? "");
  const supabase = await authenticatedClient(`/courts/${courtId}`); const { error } = await supabase.rpc("leave_court_queue", { p_queue_entry_id: entryId });
  refreshQueue(); redirect(`/courts/${courtId}${error ? `?error=${queueError(error)}` : "?notice=left"}`);
}

export async function callNextQueueTeamAction(formData:FormData){
 const courtId=String(formData.get("courtId")) as CourtId;const supabase=await authenticatedClient(`/courts/${courtId}`);
 const{error}=await supabase.rpc("call_next_queue_team",{p_court_id:courtId});refreshQueue();redirect(`/courts/${courtId}${error?`?error=${queueError(error)}`:"?notice=called"}#check-in`);
}

export async function confirmTeamReadyAction(formData:FormData){
 const courtId=String(formData.get("courtId")) as CourtId;const checkInId=String(formData.get("checkInId"));const supabase=await authenticatedClient(`/courts/${courtId}`);
 const{data,error}=await supabase.rpc("confirm_team_ready",{p_check_in_id:checkInId});refreshQueue();
 const game=Array.isArray(data)?data[0]:data;redirect(error?`/courts/${courtId}?error=${queueError(error)}#check-in`:game?.id?`/games/${game.id}`:`/courts/${courtId}?notice=ready#check-in`);
}
