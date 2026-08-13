import{redirect}from "next/navigation";
import{CalendarPageClient}from "@/components/calendar-page-client";
import{createClient}from "@/lib/supabase/server";
import{getSupabaseDashboardData}from "@/lib/supabase-dashboard-repository";

export const dynamic="force-dynamic";
export default async function CalendarPage(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/calendar");const data=await getSupabaseDashboardData(supabase,user.id);return <CalendarPageClient events={data.events}/>}
