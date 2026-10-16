// k6 load test for MeQ (KPI-1, KPI-5). Targets the LOCAL production build and LOCAL Supabase only.
// 50 virtual users: 14 team captains join, watch, and leave queues; 36 members watch their court page.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import encoding from "k6/encoding";

const APP = __ENV.APP || "http://host.docker.internal:3100";
const SB = __ENV.SB || "http://host.docker.internal:54321";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const PASSWORD = "LoadTest-2026!";

export const options = {
  scenarios: {
    // Players arrive over 30 seconds, as at the courts in the evening, then 50 stay active.
    players: { executor: "ramping-vus", startVUs: 0, gracefulRampDown: "60s",
      stages: [{ duration: "30s", target: 50 }, { duration: __ENV.DURATION || "3m", target: 50 }] },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max", "count"],
};

const joinOk = new Counter("join_ok");
const joinRefused = new Counter("join_refused");
const raceBothOk = new Counter("race_both_ok");
const leaveOk = new Counter("leave_ok");
const leaveRefused = new Counter("leave_refused");
const pageTime = new Trend("page_duration", true);
const rpcTime = new Trend("rpc_duration", true);

// Business-rule refusals (400/409 from PostgREST) are expected answers, not failed requests.
// leave_court_queue returns nothing, so PostgREST answers 204.
const rpcStatuses = http.expectedStatuses(200, 204, 400, 409);

function userFor(n) {
  const isThree = n <= 30;
  const captain = isThree ? n % 3 === 1 : (n - 31) % 5 === 0;
  return { n, captain, courts: isThree ? ["3x3-a", "3x3-b"] : ["5x5", "5x5"] };
}

export function setup() {
  const sessions = [];
  for (let n = 1; n <= 50; n++) {
    const email = `load${String(n).padStart(2, "0")}@meq.test`;
    const r = http.post(`${SB}/auth/v1/token?grant_type=password`, JSON.stringify({ email, password: PASSWORD }),
      { headers: { apikey: KEY, "Content-Type": "application/json" }, tags: { phase: "setup" } });
    const s = r.json();
    s.expires_at = s.expires_at || Math.floor(Date.now() / 1000) + s.expires_in;
    sessions.push(s);
  }
  return { sessions };
}

function cookieFor(session) {
  const value = "base64-" + encoding.b64encode(JSON.stringify(session), "rawurl");
  const name = "sb-127-auth-token";
  if (value.length <= 3180) return `${name}=${value}`;
  const parts = [];
  for (let i = 0; i * 3180 < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * 3180, (i + 1) * 3180)}`);
  return parts.join("; ");
}

function page(path, cookie) {
  const r = http.get(`${APP}${path}`, { headers: { Cookie: cookie }, redirects: 0, tags: { kind: "page", name: path.replace(/[0-9a-f-]{36}/, ":id") } });
  check(r, { "page 200": (x) => x.status === 200 });
  pageTime.add(r.timings.duration);
  return r;
}

function rpcRequest(fn, body, token) {
  return {
    method: "POST", url: `${SB}/rest/v1/rpc/${fn}`, body: JSON.stringify(body),
    params: { headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      responseCallback: rpcStatuses, tags: { kind: "rpc", name: fn } },
  };
}

function reasonOf(r) {
  try { return (r.json() || {}).message || String(r.status); } catch (e) { return String(r.status || r.error_code); }
}

export default function (data) {
  const user = userFor(__VU);
  const session = data.sessions[__VU - 1];
  const cookie = cookieFor(session);
  const court = user.courts[0];

  if (!user.captain) {
    page(`/courts/${court}`, cookie);
    sleep(10); // the court page refreshes itself every 10 seconds
    return;
  }

  page(`/courts/${court}`, cookie);
  // Race: the captain tries to join two queues (or the same queue twice) at the same moment.
  const results = http.batch([
    rpcRequest("join_court_queue", { p_court_id: user.courts[0] }, session.access_token),
    rpcRequest("join_court_queue", { p_court_id: user.courts[1] }, session.access_token),
  ]);
  let entryId = null;
  let ok = 0;
  for (const r of results) {
    rpcTime.add(r.timings.duration);
    if (r.status === 200) { ok++; joinOk.add(1); entryId = r.json().id; } else { joinRefused.add(1, { reason: reasonOf(r) }); }
  }
  if (ok > 1) raceBothOk.add(1);

  for (let i = 0; i < 3; i++) { sleep(10); page(`/courts/${court}`, cookie); }

  if (entryId) {
    const r = http.post(`${SB}/rest/v1/rpc/leave_court_queue`, JSON.stringify({ p_queue_entry_id: entryId }),
      { headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        responseCallback: rpcStatuses, tags: { kind: "rpc", name: "leave_court_queue" } });
    rpcTime.add(r.timings.duration);
    if (r.status === 200 || r.status === 204) leaveOk.add(1); else leaveRefused.add(1, { reason: reasonOf(r) });
  }
  sleep(1 + Math.random() * 4);
}

export function handleSummary(data) {
  return { [(__ENV.OUT || "/out") + "/summary.json"]: JSON.stringify(data, null, 1), stdout: "" };
}
