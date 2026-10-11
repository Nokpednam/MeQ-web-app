"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { dispatchLineNotificationsQuietly } from "@/lib/line-dispatcher";
import { createClient } from "@/lib/supabase/server";
async function adminClient() {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await s
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "ADMIN") redirect("/?notice=admin-only");
  return s;
}
function refresh() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/courts", "layout");
  revalidatePath("/admin");
}
export async function setCourtOpenAction(form: FormData) {
  const s = await adminClient();
  await s.rpc("admin_set_court_open", {
    p_court_id: String(form.get("courtId")),
    p_is_open: String(form.get("isOpen")) === "true",
  });
  refresh();
}
export async function setTargetScoreAction(form: FormData) {
  const s = await adminClient();
  await s.rpc("admin_set_daily_target", {
    p_court_group_id: String(form.get("groupId")),
    p_target_score: Number(form.get("score")),
  });
  refresh();
}
export async function setCheckInDurationAction(form: FormData) {
  const s = await adminClient();
  const duration = Number(form.get("durationSeconds"));
  if (!Number.isInteger(duration) || duration < 60 || duration > 600)
    throw new Error("INVALID_CHECK_IN_DURATION");
  await s.rpc("admin_set_check_in_duration", { p_duration_seconds: duration });
  refresh();
}
export async function saveCourtEventAction(form: FormData) {
  const s = await adminClient();
  const date = String(form.get("date")),
    allDay = form.get("allDay") === "on",
    start = allDay ? "00:00" : String(form.get("startTime")),
    end = allDay ? "23:59" : String(form.get("endTime"));
  await s.rpc("admin_save_court_event", {
    p_event_id: form.get("eventId") ? String(form.get("eventId")) : null,
    p_title: String(form.get("title")).trim(),
    p_details: String(form.get("details") ?? "").trim(),
    p_starts_at: `${date}T${start}:00+07:00`,
    p_ends_at: `${date}T${end}:00+07:00`,
    p_all_day: allDay,
    p_court_ids: form.getAll("courtIds").map(String),
  });
  refresh();
}
export async function cancelCourtEventAction(form: FormData) {
  const s = await adminClient();
  await s.rpc("admin_cancel_court_event", {
    p_event_id: String(form.get("eventId")),
  });
  refresh();
}

function gameRpcError(error: { message?: string } | null) {
  return error?.message?.match(/[A-Z][A-Z_]+/)?.[0] ?? "UNKNOWN_ERROR";
}

export async function adminCancelGameAction(form: FormData) {
  const s = await adminClient();
  const { error } = await s.rpc("admin_cancel_game", { p_game_id: String(form.get("gameId")) });
  refresh();
  after(dispatchLineNotificationsQuietly);
  redirect(`/admin?game=${error ? `error-${gameRpcError(error)}` : "cancelled"}#active-games`);
}

export async function adminResolveGameAction(form: FormData) {
  const s = await adminClient();
  const teamAScore = Number(form.get("teamAScore"));
  const teamBScore = Number(form.get("teamBScore"));
  if (!Number.isSafeInteger(teamAScore) || !Number.isSafeInteger(teamBScore) || teamAScore < 0 || teamBScore < 0) {
    redirect("/admin?game=error-INVALID_SCORE_VALUE#active-games");
  }
  const { error } = await s.rpc("admin_resolve_game", { p_game_id: String(form.get("gameId")), p_team_a_score: teamAScore, p_team_b_score: teamBScore });
  refresh();
  after(dispatchLineNotificationsQuietly);
  redirect(`/admin?game=${error ? `error-${gameRpcError(error)}` : "resolved"}#active-games`);
}
