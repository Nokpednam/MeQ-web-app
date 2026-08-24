"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CourtId } from "@/lib/queue-types";

export type LocationVerificationResult =
  | { ok: true; distanceMetres: number; expiresAt: string }
  | { ok: false; error: string };

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

export async function verifyCourtLocationAction(
  courtId: CourtId,
  latitude: number,
  longitude: number,
  accuracyMetres: number,
): Promise<LocationVerificationResult> {
  if (!["3x3-a", "3x3-b", "5x5"].includes(courtId)) return { ok: false, error: "COURT_NOT_FOUND" };
  if (![latitude, longitude, accuracyMetres].every(Number.isFinite)) return { ok: false, error: "INVALID_COORDINATES" };
  const supabase = await authenticatedClient(`/courts/${courtId}`);
  const { data, error } = await supabase.rpc("verify_court_location", {
    p_court_id: courtId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_metres: accuracyMetres,
  });
  if (error) return { ok: false, error: queueError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "UNKNOWN_ERROR" };
  return {
    ok: true,
    distanceMetres: Number(row.distance_metres),
    expiresAt: String(row.expires_at),
  };
}

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
