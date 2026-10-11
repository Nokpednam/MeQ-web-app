import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { WelcomeGuide } from "@/components/welcome-guide";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseDashboardData } from "@/lib/supabase-dashboard-repository";
export const dynamic="force-dynamic";
export default async function HomePage({searchParams}:{searchParams:Promise<{guide?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/");
  const[data,onboarding,query]=await Promise.all([
    getSupabaseDashboardData(supabase,user.id),
    supabase.from("profiles").select("onboarding_completed_at").eq("id",user.id).maybeSingle(),
    searchParams,
  ]);
  // If the column is missing (migration not applied yet), never show the guide.
  const needsOnboarding=!onboarding.error&&onboarding.data!==null&&onboarding.data.onboarding_completed_at===null;
  return <><Dashboard data={data}/><WelcomeGuide displayName={data.profile.displayName} open={needsOnboarding||query.guide==="1"}/></>;
}
