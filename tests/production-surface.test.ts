import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");

test("root layout does not mount localStorage simulation providers", () => {
  const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
  assert.doesNotMatch(layout, /AppProviders|LocalStorage/);
});

test("legacy simulator entry points stay removed", () => {
  const removedFiles = [
    "components/app-providers.tsx",
    "components/court-detail-client.tsx",
    "components/check-in-panel.tsx",
    "components/game-status-client.tsx",
    "components/game-scores-client.tsx",
    "components/game-result-client.tsx",
    "lib/queue-repository.ts",
    "lib/team-repository.ts",
    "lib/check-in-repository.ts",
    "lib/game-repositories.ts",
  ];
  for (const file of removedFiles) assert.equal(existsSync(resolve(root, file)), false, file);
});

test("production profile does not present itself as development data", () => {
  const profile = readFileSync(resolve(root, "components/profile-page.tsx"), "utf8");
  assert.doesNotMatch(profile, /<span>DEV<\/span>/);
});

test("desktop navigation highlights only an explicitly current route", () => {
  const styles = readFileSync(resolve(root, "app/globals.css"), "utf8");
  const dashboard = readFileSync(resolve(root, "components/dashboard.tsx"), "utf8");
  assert.doesNotMatch(styles, /\.desktop-nav a:first-child/);
  assert.match(styles, /\.desktop-nav a\.nav-current/);
  assert.match(dashboard, /href === "#top" \? "nav-current"/);
});

test("court and team headers render the LINE profile image when available", () => {
  for (const file of ["components/court-shell.tsx", "components/team-shell.tsx"]) {
    const shell = readFileSync(resolve(root, file), "utf8");
    assert.match(shell, /profile\.avatarUrl\s*\?/);
    assert.match(shell, /src=\{profile\.avatarUrl\}/);
  }
});

test("login verifies the session consistently to avoid redirect loops", () => {
  const login = readFileSync(resolve(root, "app/login/page.tsx"), "utf8");
  assert.match(login, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(login, /supabase\.auth\.getClaims\(\)/);
});

test("team membership requires an invitation acceptance", () => {
  const actions = readFileSync(resolve(root, "app/teams/actions.ts"), "utf8");
  const views = readFileSync(resolve(root, "components/supabase-team-views.tsx"), "utf8");
  assert.match(actions, /invite_team_member/);
  assert.match(actions, /accept_team_invitation/);
  assert.doesNotMatch(actions, /\.rpc\("add_team_member"/);
  assert.match(views, /acceptTeamInvitationAction/);
  assert.match(views, /declineTeamInvitationAction/);
});
