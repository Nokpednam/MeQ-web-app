"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeTeamName, validateTeamName } from "@/lib/team-rules";
import type { TeamType } from "@/lib/team-types";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/teams");
  return supabase;
}

function refreshTeamViews() {
  revalidatePath("/teams", "layout");
  revalidatePath("/profile");
  revalidatePath("/courts", "layout");
}

function rpcError(error: { message?: string } | null) {
  return error?.message?.match(/[A-Z][A-Z_]+/)?.[0] ?? "UNKNOWN_ERROR";
}

export async function createTeamAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const format = String(formData.get("format") ?? "") as TeamType;
  const invalidName = validateTeamName(name);
  if (invalidName || !["THREE_X_THREE", "FIVE_X_FIVE"].includes(format)) redirect(`/teams/create?error=${invalidName ?? "INVALID_FORMAT"}`);
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("create_team", { p_name: normalizeTeamName(name), p_format: format });
  if (error) redirect(`/teams/create?error=${rpcError(error)}`);
  refreshTeamViews();
  const team = data as { id: string };
  redirect(`/teams/${team.id}?notice=created`);
}

export async function addTeamMemberAction(formData: FormData) {
  const teamId = String(formData.get("teamId")); const userId = String(formData.get("userId"));
  const supabase = await authenticatedClient(); const { error } = await supabase.rpc("add_team_member", { p_team_id: teamId, p_user_id: userId });
  refreshTeamViews(); redirect(`/teams/${teamId}${error ? `?error=${rpcError(error)}` : ""}`);
}

export async function removeTeamMemberAction(formData: FormData) {
  const teamId = String(formData.get("teamId")); const userId = String(formData.get("userId"));
  const supabase = await authenticatedClient(); const { error } = await supabase.rpc("remove_team_member", { p_team_id: teamId, p_user_id: userId });
  refreshTeamViews(); redirect(`/teams/${teamId}${error ? `?error=${rpcError(error)}` : ""}`);
}

export async function transferCaptainAction(formData: FormData) {
  const teamId = String(formData.get("teamId")); const userId = String(formData.get("userId"));
  const supabase = await authenticatedClient(); const { error } = await supabase.rpc("transfer_team_captain", { p_team_id: teamId, p_user_id: userId });
  refreshTeamViews(); redirect(`/teams/${teamId}${error ? `?error=${rpcError(error)}` : ""}`);
}

export async function leaveTeamAction(formData: FormData) {
  const teamId = String(formData.get("teamId")); const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("leave_team", { p_team_id: teamId }); refreshTeamViews();
  redirect(error ? `/teams/${teamId}?error=${rpcError(error)}` : "/teams");
}

export async function dissolveTeamAction(formData: FormData) {
  const teamId = String(formData.get("teamId")); const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("dissolve_team", { p_team_id: teamId }); refreshTeamViews();
  redirect(error ? `/teams/${teamId}?error=${rpcError(error)}` : "/teams");
}
