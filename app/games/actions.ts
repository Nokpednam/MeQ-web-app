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
