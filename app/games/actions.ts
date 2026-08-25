"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function code(error: { message?: string } | null) {
  return error?.message?.match(/[A-Z][A-Z_]+/)?.[0] ?? "UNKNOWN_ERROR";
}

function gameId(formData: FormData) {
  const value = String(formData.get("gameId") ?? "");
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

async function decide(formData: FormData, rpc: "decide_winner_continuation" | "decide_loser_requeue", valueKey: "p_continue" | "p_requeue") {
  const id = gameId(formData);
  if (!id) redirect("/courts?error=INVALID_REQUEST");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${id}/result`);
  const value = formData.get("decision") === "true";
  const { error } = await supabase.rpc(rpc, { p_game_id: id, [valueKey]: value });
  revalidatePath(`/games/${id}/result`);
  revalidatePath("/courts", "layout");
  redirect(`/games/${id}/result?${error ? `error=${code(error)}` : "notice=decision-saved"}`);
}

export async function decideWinnerContinuationAction(formData: FormData) {
  await decide(formData, "decide_winner_continuation", "p_continue");
}

export async function decideLoserRequeueAction(formData: FormData) {
  await decide(formData, "decide_loser_requeue", "p_requeue");
}

async function gameMutation(formData: FormData, rpc: "request_game_end" | "cancel_game_end_request" | "reject_game_end_request") {
  const id = gameId(formData);
  if (!id) redirect("/courts?error=INVALID_REQUEST");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${id}`);
  const { error } = await supabase.rpc(rpc, { p_game_id: id });
  revalidatePath(`/games/${id}`);
  revalidatePath(`/games/${id}/scores`);
  redirect(error ? `/games/${id}?error=${code(error)}` : rpc === "request_game_end" ? `/games/${id}/scores` : `/games/${id}?notice=saved`);
}

export async function requestGameEndAction(formData: FormData) { await gameMutation(formData, "request_game_end"); }
export async function cancelGameEndAction(formData: FormData) { await gameMutation(formData, "cancel_game_end_request"); }
export async function rejectGameEndAction(formData: FormData) { await gameMutation(formData, "reject_game_end_request"); }

export async function submitTeamScoresAction(formData: FormData) {
  const id = gameId(formData);
  if (!id) redirect("/courts?error=INVALID_REQUEST");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${id}/scores`);
  const scores: Record<string, number> = {};
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("score:")) continue;
    const userId = key.slice(6);
    const value = Number(rawValue);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId) || !Number.isSafeInteger(value) || value < 0) {
      redirect(`/games/${id}/scores?error=INVALID_SCORE_VALUE`);
    }
    scores[userId] = value;
  }
  const { data, error } = await supabase.rpc("submit_team_scores", { p_game_id: id, p_scores: scores });
  revalidatePath(`/games/${id}`); revalidatePath(`/games/${id}/scores`); revalidatePath(`/games/${id}/result`); revalidatePath("/courts", "layout");
  const result = Array.isArray(data) ? data[0] : data;
  redirect(error ? `/games/${id}/scores?error=${code(error)}` : result?.status === "COMPLETED" ? `/games/${id}/result` : `/games/${id}/scores?notice=submitted`);
}
