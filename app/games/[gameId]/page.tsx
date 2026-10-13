import { notFound, redirect } from "next/navigation";
import { SupabaseGameStatus } from "@/components/supabase-game-status";
import { getSupabaseGame } from "@/lib/supabase-game-repository";
import { createClient } from "@/lib/supabase/server";
export default async function Page({params}:{params:Promise<{gameId:string}>}){const{gameId}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)notFound();const game=await getSupabaseGame(supabase,gameId,user.id);if(!game)notFound();
  // Winner and loser decisions live on the result page, so send everyone there.
  if(game.status==="COMPLETED")redirect(`/games/${game.id}/result`);
  return <SupabaseGameStatus game={game}/>}
