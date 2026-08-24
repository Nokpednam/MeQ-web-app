import { redirect } from "next/navigation";
import { CourtShell } from "@/components/court-shell";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getTeamPageData } from "@/lib/supabase-team-repository";
export default async function CourtsLayout({children}:{children:React.ReactNode}){const{supabase,user}=await getAuthenticatedUser();if(!user)redirect("/login?next=/courts");const{currentUser}=await getTeamPageData(supabase,user.id);return <CourtShell profile={currentUser}>{children}</CourtShell>}
