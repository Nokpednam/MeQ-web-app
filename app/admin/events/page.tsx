import { AdminEventsPage } from "@/components/admin-events-page";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminData } from "@/lib/supabase-admin-repository";

export const dynamic = "force-dynamic";

// The admin layout already redirects anyone who is not an administrator.
export default async function AdminEventsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await getSupabaseAdminData(supabase, user!.id);
  // Newest first, so upcoming events sit above past ones.
  const events = [...data.events].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return <AdminEventsPage events={events} courts={data.courts}/>;
}
