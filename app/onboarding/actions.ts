"use server";

import { createClient } from "@/lib/supabase/server";

/** Marks the welcome guide as seen. Failing silently only means it shows again next time. */
export async function completeOnboardingAction() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding");
  if (error) console.error("complete_onboarding failed", error.message);
}
