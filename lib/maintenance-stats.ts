// Types and formatting for the admin maintenance statistics page.

export type MaintenanceStatsBucket = { key: string; total: number };

export type MaintenanceStats = {
  periodDays: number | null;
  total: number;
  open: number;
  byStatus: Partial<Record<string, number>>;
  byCourt: MaintenanceStatsBucket[];
  byCategory: MaintenanceStatsBucket[];
  avgResponseHours: number | null;
  medianResponseHours: number | null;
  avgResolutionHours: number | null;
  medianResolutionHours: number | null;
  resolvedCount: number;
  oldestOpenHours: number | null;
};

export const maintenanceStatsPeriods = [
  { value: "7", days: 7, label: "7 วัน" },
  { value: "30", days: 30, label: "30 วัน" },
  { value: "90", days: 90, label: "90 วัน" },
  { value: "all", days: null, label: "ทั้งหมด" },
] as const;

export function parseMaintenanceStatsPeriod(value: string | undefined): number | null {
  const period = maintenanceStatsPeriods.find((option) => option.value === value);
  return period ? period.days : 30;
}

/** Human-friendly Thai duration from hours, e.g. "45 นาที", "5.5 ชม.", "2.3 วัน". */
export function formatMaintenanceHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "–";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} นาที`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} ชม.`;
  return `${Math.round((hours / 24) * 10) / 10} วัน`;
}

/** Bar width as a percentage of the largest bucket. */
export function bucketPercent(total: number, buckets: MaintenanceStatsBucket[]): number {
  const max = Math.max(0, ...buckets.map((bucket) => bucket.total));
  return max === 0 ? 0 : Math.round((total / max) * 100);
}
