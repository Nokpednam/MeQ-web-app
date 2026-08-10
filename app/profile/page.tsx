import { redirect } from "next/navigation";
import { ProfilePage } from "@/components/profile-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/profile");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("id", userId)
    .single();
  const { data: membership } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  const { data: team } = membership?.team_id
    ? await supabase.from("teams").select("id, name").eq("id", membership.team_id).maybeSingle()
    : { data: null };
  const { data: history } = await supabase
    .from("player_game_history")
    .select("game_id, format, points, won, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });
  return <ProfilePage authProfile={{
    displayName: profile?.display_name ?? String(data.claims.email ?? "ผู้ใช้งาน"),
    avatarUrl: profile?.avatar_url ?? null,
    role: profile?.role === "ADMIN" ? "ADMIN" : "USER",
    team: team ? { id: team.id, name: team.name } : null,
    history: (history ?? []).map((item) => ({
      gameId: item.game_id,
      teamType: item.format,
      points: item.points,
      won: item.won,
      completedAt: item.completed_at,
    })),
  }} />;
}
