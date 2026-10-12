import { notFound, redirect } from "next/navigation";
import { SupabaseGameScores } from "@/components/supabase-game-scores";
import { getSupabaseGame } from "@/lib/supabase-game-repository";
import { createClient } from "@/lib/supabase/server";
export default async function Page({params}:{params:Promise<{gameId:string}>}){const{gameId}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)notFound();const game=await getSupabaseGame(supabase,gameId,user.id);if(!game)notFound();
  // Live refresh lands both teams on the result once the other team's submission completes the game.
  if(game.status==="COMPLETED")redirect(`/games/${game.id}/result`);if(game.status==="CANCELLED")redirect(`/games/${game.id}`);
  return <SupabaseGameScores game={game}/>}
