"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGameLifecycle } from "./game-lifecycle-provider";
import { useMeqLanguage } from "./use-meq-language";
import { gameTranslations } from "@/lib/game-translations";
import { gameFlowTranslations } from "@/lib/game-flow-translations";
import type { GameLifecycleError } from "@/lib/game-lifecycle-types";

export function GameStatusClient({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { language } = useMeqLanguage();
  const copy = gameTranslations[language];
  const flowCopy = gameFlowTranslations[language];
  const { games, activeUserId, setActiveUser, requestEnd, cancelEnd, rejectEnd, setScenario, resetLifecycle } = useGameLifecycle();
  const [error, setError] = useState<GameLifecycleError | null>(null);
  const game = games.find((item) => item.id === gameId);
  if (!game) return <div className="game-page"><h1>{copy.gameNotFound}</h1></div>;

  const isCaptain = activeUserId === game.teamA.captainUserId || activeUserId === game.teamB.captainUserId;
  const ownRequest = game.requestedByUserId === activeUserId;
  const run = (action: () => GameLifecycleError | null) => setError(action());
  const requestAndScore = () => {
    const nextError = requestEnd(game.id);
    setError(nextError);
    if (!nextError) router.push(`/games/${game.id}/scores`);
  };

  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">GAME LIFECYCLE</p><h1>{game.teamA.teamName} <b>VS</b> {game.teamB.teamName}</h1><p>{copy.court} {game.courtId.toUpperCase()} · {copy.target} {game.targetScore} {copy.points}</p></div><Link href="/">← {copy.back}</Link></header>
    <section className="game-scoreboard"><span>{copy[`status_${game.status}` as keyof typeof copy]}</span><div><strong>{game.teamA.teamName}</strong><b>VS</b><strong>{game.teamB.teamName}</strong></div><small>{copy.started} {new Date(game.startedAt).toLocaleTimeString()}</small></section>
    {error ? <div className="team-error" role="alert">{copy[`error_${error}` as keyof typeof copy]}</div> : null}
    <section className="game-actions" aria-live="polite">
      <h2>{copy.game}</h2>
      {game.status === "PLAYING" && isCaptain ? <button onClick={requestAndScore}>{flowCopy.endAndScore}</button> : null}
      {game.status === "END_REQUESTED" && ownRequest ? <><Link href={`/games/${game.id}/scores`}>{copy.goScores}</Link><button className="game-secondary-action" onClick={() => run(() => cancelEnd(game.id))}>{copy.cancelRequest}</button></> : null}
      {game.status === "END_REQUESTED" && isCaptain && !ownRequest ? <><Link href={`/games/${game.id}/scores`}>{flowCopy.confirmByScores}</Link><button className="game-secondary-action" onClick={() => run(() => rejectEnd(game.id))}>{flowCopy.rejectEnd}</button></> : null}
      {game.status === "END_REQUESTED" ? <p>{ownRequest ? flowCopy.waitingOpponentScore : flowCopy.opponentRequestedEnd}</p> : null}
      {(game.status === "AWAITING_SCORE" || game.status === "INVALID_SCORE") ? <Link href={`/games/${game.id}/scores`}>{copy.goScores}</Link> : null}
      {game.status === "COMPLETED" ? <Link href={`/games/${game.id}/result`}>{copy.viewResult}</Link> : null}
      {!isCaptain ? <p>{copy.notCaptain}</p> : null}
    </section>
    {process.env.NODE_ENV === "development" ? <aside className="game-dev-tools"><strong>DEV · {copy.dev}</strong><label>{copy.switchCaptain}<select value={activeUserId ?? ""} onChange={(event) => setActiveUser(event.target.value)}><option value={game.teamA.captainUserId}>{game.teamA.teamName}</option><option value={game.teamB.captainUserId}>{game.teamB.teamName}</option></select></label><button onClick={() => setScenario(game.id, "FIRST_WIN")}>{copy.holding}</button><button onClick={() => setScenario(game.id, "SECOND_WIN")}>{copy.resting}</button><button onClick={() => setScenario(game.id, "REST_GAME")}>{copy.game} · REST</button><button onClick={() => setScenario(game.id, "RETURNING")}>{copy.returning}</button><button onClick={resetLifecycle}>{copy.reset}</button></aside> : null}
  </div>;
}
