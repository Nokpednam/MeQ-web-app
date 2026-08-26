/* eslint-disable @typescript-eslint/no-unused-vars */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseQueueData } from "./supabase-queue-repository";
import type { CourtId } from "./queue-types";
export type AdminEventRow = {
  id: string;
  title: string;
  details: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  cancelledAt: string | null;
  courtIds: CourtId[];
};
export type AdminMaintenanceRow = {
  id: string;
  courtId: CourtId;
  category: string;
  details: string;
  imageUrl: string | null;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED";
  adminNote: string | null;
  createdAt: string;
};
export type SupabaseAdminData = {
  courts: {
    id: CourtId;
    name: string;
    isOpen: boolean;
    groupId: string;
    format: string;
    targetScore: number;
    allowedScores: number[];
  }[];
  events: AdminEventRow[];
  checkInDurationSeconds: number;
  waitingCount: number;
  activeGameCount: number;
  newReportCount: number;
};
export async function getSupabaseAdminData(
  s: SupabaseClient,
  userId: string,
): Promise<SupabaseAdminData> {
  const queue = await getSupabaseQueueData(s, userId);
  if (!queue.isAdmin) throw new Error("ADMIN_ONLY");
  const [
    groupsResult,
    scoresResult,
    eventsResult,
    settingsResult,
    gamesResult,
    reportsResult,
  ] = await Promise.all([
    s
      .from("court_groups")
      .select("id,format,allowed_target_scores,default_target_score"),
    s
      .from("daily_score_settings")
      .select("court_group_id,target_score,business_date")
      .order("business_date", { ascending: false }),
    s
      .from("court_events")
      .select(
        "id,title,details,starts_at,ends_at,all_day,cancelled_at,court_event_courts(court_id)",
      )
      .order("starts_at"),
    s
      .from("queue_settings")
      .select("check_in_duration_seconds")
      .eq("singleton", true)
      .maybeSingle(),
    s
      .from("games")
      .select("id", { count: "exact", head: true })
      .in("status", [
        "PLAYING",
        "END_REQUESTED",
        "AWAITING_SCORE",
        "VALIDATING_RESULT",
        "INVALID_SCORE",
      ]),
    s
      .from("maintenance_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "NEW"),
  ]);
  const groups = new Map((groupsResult.data ?? []).map((g) => [g.id, g]));
  const latest = new Map<string, number>();
  for (const row of scoresResult.data ?? [])
    if (!latest.has(row.court_group_id))
      latest.set(row.court_group_id, row.target_score);
  return {
    courts: queue.courts.map((c) => {
      const row = queue.courts.find((x) => x.id === c.id) as typeof c;
      const group = [...groups.entries()].find(
        ([, g]) => g.format === c.type,
      )?.[1];
      return {
        id: c.id,
        name: c.name,
        isOpen: c.isOpen,
        groupId: c.type === "THREE_X_THREE" ? "3x3" : "5x5",
        format: c.type,
        targetScore:
          latest.get(c.type === "THREE_X_THREE" ? "3x3" : "5x5") ??
          c.targetScore,
        allowedScores: group?.allowed_target_scores ?? c.allowedTargetScores,
      };
    }),
    events: (eventsResult.data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      details: e.details,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      allDay: e.all_day,
      cancelledAt: e.cancelled_at,
      courtIds: (e.court_event_courts ?? []).map(
        (x: { court_id: CourtId }) => x.court_id,
      ),
    })),
    checkInDurationSeconds:
      settingsResult.data?.check_in_duration_seconds ?? 180,
    waitingCount: queue.entries.filter((e) => e.status === "WAITING").length,
    activeGameCount: gamesResult.count ?? 0,
    newReportCount: reportsResult.count ?? 0,
  };
}
