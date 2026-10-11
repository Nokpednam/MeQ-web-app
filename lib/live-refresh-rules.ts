// Rules for refreshing server-rendered queue pages in the background. The
// database stays the source of truth; the browser only asks for fresh HTML.

export const LIVE_REFRESH_INTERVAL_MS = 10_000;

const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export type LiveRefreshContext = {
  documentHidden: boolean;
  online: boolean;
  /** Tag name of document.activeElement, if any. */
  activeTagName: string | null;
  activeIsContentEditable: boolean;
};

/** Skip a tick when nobody is looking, offline, or the user is typing. */
export function shouldRefreshNow(context: LiveRefreshContext): boolean {
  if (context.documentHidden || !context.online) return false;
  if (context.activeIsContentEditable) return false;
  if (context.activeTagName && editableTags.has(context.activeTagName.toUpperCase())) return false;
  return true;
}

/** Seconds since the last refresh, for the "updated N seconds ago" label. */
export function secondsSince(lastRefreshAt: number, now: number): number {
  return Math.max(0, Math.floor((now - lastRefreshAt) / 1000));
}
