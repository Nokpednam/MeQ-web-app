// Pure helpers for the LINE Messaging API push endpoint. Kept free of Next and
// Supabase imports so the Node rule tests can cover them.

export const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_TEXT_LIMIT = 5000;

export type LineDeliveryOutcome = "SENT" | "RETRY" | "FAILED";

export function buildLineMessageText(message: string, linkPath: string | null, appUrl: string | undefined): string {
  const base = appUrl?.replace(/\/+$/, "");
  const text = base && linkPath ? `${message}\n\n${base}${linkPath}` : message;
  return text.length > LINE_TEXT_LIMIT ? text.slice(0, LINE_TEXT_LIMIT) : text;
}

export function buildLinePushBody(lineUserId: string, text: string) {
  return { to: lineUserId, messages: [{ type: "text", text }] };
}

/**
 * Maps a LINE push response to an outbox outcome. Each request carries the
 * notification id as X-Line-Retry-Key, so 409 means LINE already accepted an
 * earlier attempt of the same message.
 */
export function classifyLinePushStatus(status: number | null): LineDeliveryOutcome {
  if (status === null) return "RETRY";
  if (status >= 200 && status < 300) return "SENT";
  if (status === 409) return "SENT";
  if (status === 429 || status >= 500) return "RETRY";
  return "FAILED";
}
