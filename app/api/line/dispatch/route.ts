import { timingSafeEqual } from "node:crypto";
import { dispatchLineNotifications } from "@/lib/line-dispatcher";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.LINE_DISPATCH_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// Called every minute by the database (pg_cron + pg_net) when messages are waiting.
export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const result = await dispatchLineNotifications();
    return Response.json(result, { status: result.status === "NOT_CONFIGURED" ? 503 : 200 });
  } catch (error) {
    console.error("LINE dispatch failed", error);
    return Response.json({ error: "DISPATCH_FAILED" }, { status: 500 });
  }
}
