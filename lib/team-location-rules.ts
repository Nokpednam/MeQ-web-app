export type TeamLocationStatusLike = {
  status: "VERIFIED" | "MISSING" | "EXPIRED";
  expiresAt: string | null;
};

export function isTeamLocationReady(item: TeamLocationStatusLike, now: number) {
  if (item.status !== "VERIFIED" || !item.expiresAt) return false;
  const expiresAt = Date.parse(item.expiresAt);
  return Number.isFinite(expiresAt) && (now === 0 || expiresAt > now);
}

export function getTeamLocationSummary(
  statuses: TeamLocationStatusLike[],
  requiredMembers: number,
  now: number,
) {
  const readyCount = statuses.filter((item) => isTeamLocationReady(item, now)).length;
  return {
    readyCount,
    missingSlots: Math.max(0, requiredMembers - statuses.length),
    allReady: statuses.length === requiredMembers && readyCount === requiredMembers,
  };
}

export function getNextLocationExpiry(statuses: TeamLocationStatusLike[], now: number) {
  const futureExpiries = statuses
    .filter((item) => isTeamLocationReady(item, now))
    .map((item) => Date.parse(item.expiresAt!));
  return futureExpiries.length > 0 ? Math.min(...futureExpiries) : null;
}
