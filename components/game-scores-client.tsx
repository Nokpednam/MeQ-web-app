"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { gameTranslations } from "@/lib/game-translations";
import { scoreFormTranslations } from "@/lib/score-form-translations";
import type { GameLifecycleError } from "@/lib/game-lifecycle-types";
import { useGameLifecycle } from "./game-lifecycle-provider";
import { useMeqLanguage } from "./use-meq-language";

type SubmitPhase = "IDLE" | "VALIDATING" | "WAITING" | "SAVED";

export function GameScoresClient({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { language } = useMeqLanguage();
  const copy = gameTranslations[language];
  const scoreCopy = scoreFormTranslations[language];
  const { games, submissions, activeUserId, setActiveUser, saveDraft, submitScores } = useGameLifecycle();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<GameLifecycleError | null>(null);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("IDLE");
  const game = games.find((item) => item.id === gameId);
  const team = game
    ? game.teamA.captainUserId === activeUserId
      ? game.teamA
      : game.teamB.captainUserId === activeUserId
        ? game.teamB
        : null
    : null;
  const submission = game && team
    ? submissions.find((item) => item.gameId === game.id && item.teamId === team.teamId)
    : undefined;

  // Repository drafts hydrate the editable form whenever the selected captain changes.
  useEffect(() => {
    if (!team) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScores(Object.fromEntries(team.members.map((member) => [
      member.id,
      submission?.playerScores.find((score) => score.playerId === member.id)?.points ?? 0,
    ])));
  }, [team, submission]);

  if (!game) return <div className="game-page"><h1>{copy.gameNotFound}</h1></div>;
  if (game.status !== "AWAITING_SCORE" && game.status !== "INVALID_SCORE" && game.status !== "COMPLETED") {
    return <div className="game-page"><header className="game-page-heading"><div><p className="section-label">SCORE SUBMISSION</p><h1>{copy.awaitingScores}</h1></div><Link href={`/games/${game.id}`}>← {copy.game}</Link></header><div className="team-notice" role="status">{copy[`status_${game.status}` as keyof typeof copy]}</div></div>;
  }
  const currentGame = game;

  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const other = team?.teamId === game.teamA.teamId ? game.teamB : game.teamA;
  const otherSubmission = submissions.find((item) => item.gameId === game.id && item.teamId === other.teamId);

  function draft() {
    if (!team) return;
    setError(saveDraft(currentGame.id, team.teamId, scores));
  }

  function submit() {
    if (!team || submitPhase === "VALIDATING" || submitPhase === "SAVED") return;
    setError(null);
    const draftError = saveDraft(currentGame.id, team.teamId, scores);
    if (draftError) {
      setError(draftError);
      return;
    }
    setSubmitPhase("VALIDATING");
    const result = submitScores(currentGame.id, team.teamId);
    if (result.error) {
      setError(result.error);
      setSubmitPhase("IDLE");
      return;
    }
    if (result.outcome === "WAITING_FOR_OTHER_TEAM") {
      setSubmitPhase("WAITING");
      return;
    }
    if (result.outcome === "INVALID_SCORE") {
      setSubmitPhase("IDLE");
      return;
    }
    setSubmitPhase("SAVED");
    window.setTimeout(() => router.push(`/games/${currentGame.id}/result`), 650);
  }

  const phaseMessage = submitPhase === "VALIDATING"
    ? scoreCopy.validating
    : submitPhase === "WAITING"
      ? scoreCopy.waitingForOtherTeam
      : submitPhase === "SAVED"
        ? scoreCopy.saved
        : null;

  return <div className="game-page">
    <header className="game-page-heading"><div><p className="section-label">SCORE SUBMISSION</p><h1>{copy.scores}</h1><p>{copy.scoresHint}</p></div><Link href={`/games/${game.id}`}>← {copy.game}</Link></header>
    {game.status === "INVALID_SCORE" ? <div className="team-error" role="alert">{copy.invalid}: {game.invalidReason === "NO_TEAM_REACHED_TARGET" ? scoreCopy.noTeamReachedTarget : copy[`invalid_${game.invalidReason}` as keyof typeof copy]}</div> : null}
    {error ? <div className="team-error" role="alert">{copy[`error_${error}` as keyof typeof copy]}</div> : null}
    <div className="score-submit-status" aria-live="polite" aria-atomic="true">{phaseMessage}</div>
    {team ? <section className="score-form">
      <div className="score-form-head"><div><small>{team.teamName}</small><strong>{copy.teamTotal} {total}</strong></div><span>{submission?.status === "SUBMITTED" ? copy.submitted : copy.notSubmitted}</span></div>
      <p className="score-zero-note">{scoreCopy.zeroIsValid}</p>
      {team.members.map((member) => <label key={member.id}><span className="member-avatar">{member.initials}</span><strong>{member.displayName}</strong><input inputMode="numeric" pattern="[0-9]*" min="0" step="1" value={Number.isNaN(scores[member.id]) ? "" : scores[member.id] ?? 0} onChange={(event) => { const value = event.target.value; setScores((current) => ({ ...current, [member.id]: value === "" ? Number.NaN : Number(value) })); }} /></label>)}
      <p>{copy.otherTeam}: <b>{otherSubmission?.status === "SUBMITTED" ? copy.submitted : copy.notSubmitted}</b></p>
      <div><button onClick={draft} disabled={submitPhase === "VALIDATING" || submitPhase === "SAVED"}>{copy.saveDraft}</button><button onClick={submit} disabled={submitPhase === "VALIDATING" || submitPhase === "SAVED"} aria-busy={submitPhase === "VALIDATING"}>{copy.submit}</button></div>
    </section> : <p>{copy.notCaptain}</p>}
    {game.status === "COMPLETED" ? <Link className="game-result-link" href={`/games/${game.id}/result`}>{copy.viewResult}</Link> : null}
    {process.env.NODE_ENV === "development" ? <aside className="game-dev-tools"><strong>DEV · {copy.dev}</strong><label>{copy.switchCaptain}<select value={activeUserId ?? ""} onChange={(event) => setActiveUser(event.target.value)}><option value={game.teamA.captainUserId}>{game.teamA.teamName}</option><option value={game.teamB.captainUserId}>{game.teamB.teamName}</option></select></label><button onClick={() => team && setScores(Object.fromEntries(team.members.map((member, index) => [member.id, team.teamId === game.teamA.teamId ? [3, 2, 2][index] ?? 0 : [2, 2, 1][index] ?? 0])))}>{copy.validSample}</button><button onClick={() => team && setScores(Object.fromEntries(team.members.map((member, index) => [member.id, [3, 3, 2][index] ?? 0])))}>{copy.invalidSample}</button></aside> : null}
  </div>;
}
