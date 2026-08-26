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
