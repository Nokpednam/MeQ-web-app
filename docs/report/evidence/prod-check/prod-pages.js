// k6 check of the DEPLOYED site (KPI-5, set C). Read-only: GET requests to signed-in pages, no form submissions.
// A few virtual users share the author's own session, so it measures response time over the internet,
// not capacity; capacity is covered by the local load test (sets A and B).
//
// Usage (PowerShell), with the browser's Cookie header copied to the clipboard:
//   $env:MEQ_COOKIE = Get-Clipboard
//   k6 run -e OUT=docs/report/evidence/prod-check/run1 docs/report/evidence/prod-check/prod-pages.js
// Add -e ADMIN=1 to include the administrator pages.
import http from "k6/http";
import { check, sleep, fail } from "k6";
import encoding from "k6/encoding";

const APP = __ENV.APP || "https://meq-starter-v01.vercel.app";
const COOKIE = __ENV.MEQ_COOKIE;

const PAGES = ["/courts", "/courts/3x3-a", "/courts/3x3-b", "/courts/5x5", "/profile", "/teams", "/calendar", "/maintenance"];
if (__ENV.ADMIN === "1") PAGES.push("/admin", "/admin/maintenance", "/admin/maintenance/stats");

export const options = {
  scenarios: {
    // Three players browsing for three minutes: light enough not to disturb real users on the free tier.
    players: { executor: "constant-vus", vus: 3, duration: __ENV.DURATION || "3m" },
  },
  thresholds: Object.fromEntries([
    ["http_req_duration", ["p(95)<2000"]],
    ["http_req_failed", ["rate<0.01"]],
    ["checks", ["rate>0.99"]],
    // One threshold per page so that k6 keeps each page's timings separately.
    ...PAGES.map((p) => [`http_req_duration{name:${p}}`, ["p(95)<2000"]]),
  ]),
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max", "count"],
  // k6 empties each user's cookie jar between iterations by default, which would sign the user out after one round.
  noCookiesReset: true,
};

function setCookies() {
  const jar = http.cookieJar();
  for (const pair of COOKIE.split(";")) {
    const i = pair.indexOf("=");
    if (i > 0) jar.set(APP, pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

function get(path) {
  const r = http.get(`${APP}${path}`, { redirects: 0, tags: { name: path } });
  // A signed-out page still answers 200: Next.js streams it and puts the redirect to /login in the body.
  check(r, { "200, signed in": signedIn });
  return r;
}

function signedIn(r) {
  return r.status === 200 && !String(r.body).includes("NEXT_REDIRECT;replace;/login");
}

// Minutes until the access token in the cookie expires, so that a run does not depend on a token refresh midway.
function minutesLeft() {
  const chunks = COOKIE.split(";").map((p) => p.trim()).filter((p) => /^sb-[a-z0-9]+-auth-token(\.\d+)?=/.test(p))
    .sort((a, b) => Number((a.match(/\.(\d+)=/) || [0, -1])[1]) - Number((b.match(/\.(\d+)=/) || [0, -1])[1]));
  const value = chunks.map((p) => p.slice(p.indexOf("=") + 1)).join("").replace(/^base64-/, "");
  const session = JSON.parse(encoding.b64decode(value, "rawurl", "s"));
  return (session.expires_at - Date.now() / 1000) / 60;
}

export function setup() {
  if (!COOKIE) fail("Set MEQ_COOKIE to the Cookie header of a signed-in browser.");
  const left = minutesLeft();
  const need = Number(__ENV.NEED_MINUTES || 5);
  if (left < need) fail(`Access token expires in ${left.toFixed(0)} min, need ${need}. Sign out, sign in again, and copy a fresh cookie.`);
  console.log(`Access token valid for ${left.toFixed(0)} more minutes.`);
  setCookies();
  const r = http.get(`${APP}/profile`, { redirects: 0 });
  if (!signedIn(r)) fail("Session not accepted: /profile redirects to /login. Sign in again and copy a fresh cookie.");
}

export default function () {
  if (__ITER === 0) setCookies();
  for (const path of PAGES) {
    get(path);
    sleep(3 + Math.random() * 3);
  }
}

export function handleSummary(data) {
  const out = __ENV.OUT || "docs/report/evidence/prod-check/run";
  const lines = Object.keys(data.metrics)
    .filter((k) => k.startsWith("http_req_duration{name:"))
    .map((k) => `${k.slice(23, -1)}\tp95=${data.metrics[k].values["p(95)"].toFixed(0)} ms\tmed=${data.metrics[k].values.med.toFixed(0)} ms`);
  const all = data.metrics.http_req_duration.values;
  const failed = data.metrics.http_req_failed.values.rate;
  const text = `all\tp95=${all["p(95)"].toFixed(0)} ms\tmed=${all.med.toFixed(0)} ms\tmax=${all.max.toFixed(0)} ms\tfailed=${(failed * 100).toFixed(2)}%\n${lines.join("\n")}\n`;
  return { [`${out}/summary.json`]: JSON.stringify(data, null, 1), [`${out}/pages.txt`]: text, stdout: text };
}
