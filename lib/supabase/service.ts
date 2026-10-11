import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for trusted server jobs only (LINE dispatch). Never
 * import this from client components. Returns null when the key is not set.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
