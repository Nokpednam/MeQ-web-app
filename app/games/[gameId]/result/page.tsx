import { notFound } from "next/navigation";
import { SupabaseGameResult } from "@/components/supabase-game-result";
import { getSupabaseGameResult } from "@/lib/supabase-game-result-repository";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const game = await getSupabaseGameResult(supabase, gameId, user.id);
  if (!game) notFound();
  return <SupabaseGameResult game={game}/>;
}
