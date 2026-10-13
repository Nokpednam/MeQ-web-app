import type { GameLifecycle } from "./game-lifecycle-types";

export function isGameActive(game:GameLifecycle):boolean{return game.status==="PLAYING"||game.status==="END_REQUESTED"||game.status==="AWAITING_SCORE"}
export function getActiveGameForCourt(games:GameLifecycle[],courtId:GameLifecycle["courtId"]):GameLifecycle|undefined{return games.filter((game)=>game.courtId===courtId&&isGameActive(game)).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0]}
