"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gameTranslations } from "@/lib/game-translations";
import { winnerDecisionTranslations } from "@/lib/winner-decision-translations";
import type { GameLifecycleError, PostGameDecision } from "@/lib/game-lifecycle-types";
import { useGameLifecycle } from "./game-lifecycle-provider";
import { useMeqLanguage } from "./use-meq-language";

function DecisionTimer({ decision, label }: { decision: PostGameDecision; label: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(decision.requeueDecisionDeadline) - (now || Date.parse(decision.requeueDecisionStartedAt))) / 1000));
  return <div className="decision-timer" role="timer" aria-live="polite"><small>{label}</small><strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong></div>;
}

export function GameResultClient({ gameId }: { gameId: string }) {
  const { language } = useMeqLanguage();
  const copy = gameTranslations[language];
  const winnerCopy = winnerDecisionTranslations[language];
  const { games, submissions, decisions, activeUserId, setActiveUser, chooseWinnerContinue, chooseWinnerLeave, chooseRequeue, chooseLeave, shortenDecision, expireDecision } = useGameLifecycle();
  const [error, setError] = useState<GameLifecycleError | null>(null);
  const game = games.find((item) => item.id === gameId);
  if (!game) return <div className="game-page"><h1>{copy.gameNotFound}</h1></div>;
  if (game.status !== "COMPLETED") return <div className="game-page"><h1>{copy.result}</h1><Link href={`/games/${game.id}`}>{copy.game}</Link></div>;

  const winner = game.winnerTeamId === game.teamA.teamId ? game.teamA : game.teamB;
  const decision = decisions.find((item) => item.gameId === game.id);
  const teamASubmission = submissions.find((item) => item.gameId === game.id && item.teamId === game.teamA.teamId);
  const teamBSubmission = submissions.find((item) => item.gameId === game.id && item.teamId === game.teamB.teamId);
  const isLoserCaptain = decision?.captainUserId === activeUserId;
  const isWinnerCaptain = winner.captainUserId === activeUserId;
  const winnerDecision = game.postGame?.winnerContinuationDecision;
  const completedGameId = game.id;
  const winnerDecisionPending = Boolean(game.postGame && game.postGame.winnerConsecutiveWins < 2 && winnerDecision !== "CONTINUE" && winnerDecision !== "LEAVE");
  const winnerStatusText = winnerDecisionPending ? winnerCopy.pending : winnerDecision === "LEAVE" ? winnerCopy.left : game.postGame?.winnerStatus === "RESTING" ? copy.resting : game.postGame?.winnerStatus === "RETURNING_CHAMPION" ? copy.returning : copy.holding;

  function runWinnerDecision(continuePlaying: boolean) {
    setError(continuePlaying ? chooseWinnerContinue(completedGameId) : chooseWinnerLeave(completedGameId));
  }

  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">FINAL RESULT</p><h1>{copy.result}</h1><p>{copy.court} {game.courtId.toUpperCase()} · {copy.target} {game.targetScore}</p><p>{copy.completed} · {game.completedAt ? new Date(game.completedAt).toLocaleString(language === "th" ? "th-TH" : "en-US") : ""}</p></div><Link href="/">← {copy.back}</Link></header>
    <section className="final-result"><span>{copy.winner}</span><h2>{winner.teamName}</h2><div><strong>{game.teamA.teamName}</strong><b>{game.finalTeamAScore} : {game.finalTeamBScore}</b><strong>{game.teamB.teamName}</strong></div><p>{winnerStatusText}</p></section>
    {game.postGame?.winnerConsecutiveWins !== undefined && game.postGame.winnerConsecutiveWins < 2 ? <section className="loser-decision winner-decision"><div><h2>{winnerCopy.title}</h2><p>{winnerCopy.hint}</p>{!winnerDecisionPending ? <strong>{winnerDecision === "LEAVE" ? winnerCopy.left : winnerCopy.continued}</strong> : null}</div>{winnerDecisionPending && isWinnerCaptain ? <div><button onClick={() => runWinnerDecision(true)}>{winnerCopy.continuePlaying}</button><button onClick={() => runWinnerDecision(false)}>{winnerCopy.stopPlaying}</button></div> : null}</section> : null}
    <section className="individual-results"><h2>{copy.individualScores}</h2>{[teamASubmission, teamBSubmission].map((submission) => <article key={submission?.teamId}><strong>{submission?.teamId === game.teamA.teamId ? game.teamA.teamName : game.teamB.teamName}</strong>{submission?.playerScores.map((score) => { const member = [...game.teamA.members, ...game.teamB.members].find((item) => item.id === score.playerId); return <p key={score.playerId}><span>{member?.displayName}</span><b>{score.points}</b></p>; })}</article>)}</section>
    {decision ? <section className="loser-decision"><div><h2>{copy.requeueTitle}</h2>{decision.status === "DECIDING" ? <DecisionTimer decision={decision} label={copy.decisionTime} /> : <p>{copy.decisionDone}: {decision.decision}</p>}</div>{decision.status === "DECIDING" && isLoserCaptain ? <div><button onClick={() => setError(chooseRequeue(game.id))}>{copy.requeue}</button><button onClick={() => setError(chooseLeave(game.id))}>{copy.leave}</button></div> : null}</section> : null}
    <nav className="game-result-actions"><Link href={`/courts/${game.courtId}`}>← {copy.court}</Link><Link href="/">{copy.back}</Link></nav>
    {error ? <div className="team-error" role="alert">{copy[`error_${error}` as keyof typeof copy]}</div> : null}
    {process.env.NODE_ENV === "development" && decision ? <aside className="game-dev-tools"><strong>DEV · {copy.dev}</strong><label>{copy.switchCaptain}<select value={activeUserId ?? ""} onChange={(event) => setActiveUser(event.target.value)}><option value={game.teamA.captainUserId}>{game.teamA.teamName}</option><option value={game.teamB.captainUserId}>{game.teamB.teamName}</option></select></label><button onClick={() => shortenDecision(game.id, 10)}>{copy.tenSeconds}</button><button onClick={() => expireDecision(game.id)}>{copy.expireNow}</button></aside> : null}
  </div>;
}
