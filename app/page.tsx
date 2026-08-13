import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseDashboardData } from "@/lib/supabase-dashboard-repository";
export const dynamic="force-dynamic";
export default async function HomePage(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/");return <Dashboard data={await getSupabaseDashboardData(supabase,user.id)}/>}
