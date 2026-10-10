import "server-only";
import { createServiceClient } from "./supabase/service";
import { LINE_PUSH_ENDPOINT, buildLineMessageText, buildLinePushBody, classifyLinePushStatus } from "./line-messaging";

type ClaimedNotification = {
  id: string;
  line_user_id: string | null;
  message: string;
  link_path: string | null;
  attempts: number;
};

export type LineDispatchResult =
  | { status: "NOT_CONFIGURED" }
  | { status: "DONE"; sent: number; retry: number; failed: number };

/** Claims pending LINE notifications and pushes them. Safe to run concurrently. */
export async function dispatchLineNotifications(limit = 20): Promise<LineDispatchResult> {
  const token = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  const supabase = createServiceClient();
  // Leave messages pending; they expire on their own if LINE is never set up.
  if (!token || !supabase) return { status: "NOT_CONFIGURED" };

  const { data, error } = await supabase.rpc("claim_line_notifications", { p_limit: limit });
  if (error) throw new Error(`LINE_CLAIM_FAILED: ${error.message}`);

  const result = { status: "DONE" as const, sent: 0, retry: 0, failed: 0 };
  for (const notification of (data ?? []) as ClaimedNotification[]) {
    let outcome: "SENT" | "RETRY" | "FAILED";
    let detail: string | null = null;

    if (!notification.line_user_id) {
      outcome = "FAILED";
      detail = "NO_LINE_IDENTITY";
    } else {
      let status: number | null = null;
      try {
        const response = await fetch(LINE_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Line-Retry-Key": notification.id,
          },
          body: JSON.stringify(buildLinePushBody(
            notification.line_user_id,
            buildLineMessageText(notification.message, notification.link_path, process.env.NEXT_PUBLIC_APP_URL),
          )),
          signal: AbortSignal.timeout(8000),
        });
        status = response.status;
        if (!response.ok) detail = `HTTP_${status}: ${(await response.text()).slice(0, 300)}`;
      } catch (fetchError) {
        detail = `NETWORK: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
      }
      outcome = classifyLinePushStatus(status);
    }

    const { error: completeError } = await supabase.rpc("complete_line_notification", {
      p_id: notification.id,
      p_outcome: outcome,
      p_error: detail,
    });
    if (completeError) throw new Error(`LINE_COMPLETE_FAILED: ${completeError.message}`);
    if (outcome === "SENT") result.sent += 1;
    else if (outcome === "RETRY") result.retry += 1;
    else result.failed += 1;
  }
  return result;
}

/** Fire-and-forget dispatch for use inside `after()`; errors are only logged. */
export async function dispatchLineNotificationsQuietly(): Promise<void> {
  try {
    await dispatchLineNotifications();
  } catch (error) {
    console.error("LINE dispatch failed", error);
  }
}
