"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTeamData } from "@/components/team-provider";
import { useMeqLanguage } from "@/components/use-meq-language";
import { teamTranslations } from "@/lib/dashboard-translations";
import { getTeamErrorMessage } from "@/lib/team-error-copy";
import { getTeamCapacity, validateTeamName } from "@/lib/team-rules";
import type { TeamRuleError, TeamType } from "@/lib/team-types";

export default function CreateTeamPage() {
  const router = useRouter();
  const { language } = useMeqLanguage();
  const copy = teamTranslations[language];
  const { ready, currentTeam, createTeam } = useTeamData();
  const [name, setName] = useState("");
  const [type, setType] = useState<TeamType>("THREE_X_THREE");
  const [error, setError] = useState<TeamRuleError | null>(null);
  const createdFromThisPage = useRef(false);

  useEffect(() => {
    if (ready && currentTeam && !createdFromThisPage.current) router.replace(`/teams/${currentTeam.id}?notice=already-member`);
  }, [currentTeam, ready, router]);

  if (!ready || currentTeam) return <div className="team-loading" role="status">{currentTeam ? copy.alreadyHasTeamNotice : copy.loading}</div>;

  function submitTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateTeamName(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    createdFromThisPage.current = true;
    const result = createTeam(name, type);
    if (!result.ok) {
      createdFromThisPage.current = false;
      setError(result.error);
      return;
    }
    if (result.teamId) router.push(`/teams/${result.teamId}`);
  }

  return (
    <div className="team-page team-form-page">
      <header className="team-page-heading"><div><p className="section-label">{copy.pageLabel}</p><h1>{copy.createTeamTitle}</h1><p>{copy.createTeamIntro}</p></div><Link className="back-link" href="/teams">← {copy.cancel}</Link></header>
      <form className="create-team-form" onSubmit={submitTeam} noValidate>
        <div className="form-section">
          <label htmlFor="team-name">{copy.teamName}</label>
          <input id="team-name" value={name} onChange={(event) => { setName(event.target.value); setError(null); }} placeholder={copy.teamNamePlaceholder} maxLength={30} autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? "team-name-error" : undefined} />
          <div className="input-meta"><span>{name.trim().length}/30</span>{error ? <strong id="team-name-error" role="alert">{getTeamErrorMessage(error, copy)}</strong> : null}</div>
        </div>
        <fieldset className="form-section team-type-fieldset">
          <legend>{copy.teamType}</legend>
          <div className="team-type-options">
            {(["THREE_X_THREE", "FIVE_X_FIVE"] as const).map((teamType) => (
              <label className={type === teamType ? "is-selected" : ""} key={teamType}>
                <input type="radio" name="team-type" value={teamType} checked={type === teamType} onChange={() => setType(teamType)} />
                <strong>{teamType === "THREE_X_THREE" ? "3x3" : "5x5"}</strong>
                <span>{copy.maxMembers} {getTeamCapacity(teamType)} {copy.people}</span>
              </label>
            ))}
          </div>
          <p className="form-note">✓ {copy.captainFirst}</p>
        </fieldset>
        <div className="form-actions"><Link className="team-secondary-button" href="/teams">{copy.cancel}</Link><button className="team-primary-button" type="submit">{copy.createSubmit}<b>→</b></button></div>
      </form>
    </div>
  );
}
