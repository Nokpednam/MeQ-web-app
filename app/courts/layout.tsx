import { redirect } from "next/navigation";
import { CourtShell } from "@/components/court-shell";
import { createClient } from "@/lib/supabase/server";
import { getTeamPageData } from "@/lib/supabase-team-repository";
export default async function CourtsLayout({children}:{children:React.ReactNode}){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/courts");const{currentUser}=await getTeamPageData(supabase,user.id);return <CourtShell profile={currentUser}>{children}</CourtShell>}
