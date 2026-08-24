import { cache } from "react";
import { createClient } from "./server";

/**
 * Share the verified Supabase user and server client across layouts and pages
 * rendered as part of the same request.
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});
