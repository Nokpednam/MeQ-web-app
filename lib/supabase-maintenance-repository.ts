import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaintenanceStatus } from "./admin-types";
import type { CourtId } from "./queue-types";

export type AdminMaintenanceRow = {
  id: string;
  courtId: CourtId;
  category: string;
  details: string;
  /** Signed URL for display (expires in 15 min). */
  imageUrl: string | null;
  history: MaintenanceHistoryEntry[];
  status: MaintenanceStatus;
  adminNote: string | null;
  createdAt: string;
};

type MaintenanceFeedRow = {
  id: string;
  court_id: string;
  category: string;
  details: string;
  image_path: string | null;
  status: MaintenanceStatus;
  admin_note: string | null;
  created_at: string;
};

export type MaintenanceHistoryEntry = {
  fromStatus: MaintenanceStatus | null;
  toStatus: MaintenanceStatus;
  adminNote: string | null;
  changedByName: string | null;
  changedAt: string;
};

type MaintenanceHistoryFeedRow = {
  report_id: string;
  from_status: MaintenanceStatus | null;
  to_status: MaintenanceStatus;
  admin_note: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

export type MyMaintenanceRow = Omit<AdminMaintenanceRow, "imageUrl" | "history">;
export type PublicMaintenanceRow = MyMaintenanceRow & { updatedAt: string };
type PublicMaintenanceFeedRow = MaintenanceFeedRow & { updated_at: string };

export async function getPublicMaintenanceReports(supabase: SupabaseClient): Promise<PublicMaintenanceRow[]> {
  const { data, error } = await supabase.rpc("list_public_maintenance_status");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return [];
    throw new Error(`PUBLIC_MAINTENANCE_FAILED: ${error.message}`);
  }
  return ((data ?? []) as PublicMaintenanceFeedRow[]).map((row) => ({
    id: row.id,
    courtId: row.court_id as CourtId,
    category: row.category,
    details: row.details,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getMyMaintenanceReports(supabase: SupabaseClient): Promise<MyMaintenanceRow[]> {
  const { data, error } = await supabase.rpc("list_my_maintenance_reports");
  if (error) throw new Error(`MY_MAINTENANCE_FAILED: ${error.message}`);
  return ((data ?? []) as MaintenanceFeedRow[]).map((row) => ({
    id: row.id,
    courtId: row.court_id as CourtId,
    category: row.category,
    details: row.details,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
  }));
}

export async function getAdminMaintenanceReports(supabase: SupabaseClient): Promise<AdminMaintenanceRow[]> {
  const { data, error } = await supabase.rpc("admin_list_maintenance_reports");
  if (error) throw new Error(`MAINTENANCE_FEED_FAILED: ${error.message}`);
  const rows = (data ?? []) as MaintenanceFeedRow[];

  const historyByReport = new Map<string, MaintenanceHistoryEntry[]>();
  if (rows.length > 0) {
    const { data: historyData, error: historyError } = await supabase.rpc("admin_list_maintenance_history", {
      p_report_ids: rows.map((row) => row.id),
    });
    // Tolerate a database that does not have the history migration yet.
    if (historyError && historyError.code !== "PGRST202" && historyError.code !== "42883") {
      throw new Error(`MAINTENANCE_HISTORY_FAILED: ${historyError.message}`);
    }
    for (const entry of (historyData ?? []) as MaintenanceHistoryFeedRow[]) {
      const list = historyByReport.get(entry.report_id) ?? [];
      list.push({
        fromStatus: entry.from_status,
        toStatus: entry.to_status,
        adminNote: entry.admin_note,
        changedByName: entry.changed_by_name,
        changedAt: entry.changed_at,
      });
      historyByReport.set(entry.report_id, list);
    }
  }

  return Promise.all(rows.map(async (row) => {
    let imageUrl: string | null = null;
    if (row.image_path) {
      const { data: signed } = await supabase.storage.from("maintenance-evidence").createSignedUrl(row.image_path, 900);
      imageUrl = signed?.signedUrl ?? null;
    }
    return {
      id: row.id,
      courtId: row.court_id as CourtId,
      category: row.category,
      details: row.details,
      imageUrl,
      history: historyByReport.get(row.id) ?? [],
      status: row.status,
      adminNote: row.admin_note,
      createdAt: row.created_at,
    };
  }));
}

/** Deletes a maintenance report and its storage image (if any). Admin-only. */
export async function deleteMaintenanceReport(
  supabase: SupabaseClient,
  reportId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("admin_delete_maintenance_report", {
    p_report_id: reportId,
  });
  if (error) throw new Error(`DELETE_MAINTENANCE_FAILED: ${error.message}`);
  // The RPC returns the stored path, so a browser-supplied path is never used.
  const imagePath = typeof data === "string" ? data : null;
  if (imagePath) {
    // Best-effort – do not throw on storage errors.
    await supabase.storage.from("maintenance-evidence").remove([imagePath]);
  }
}
