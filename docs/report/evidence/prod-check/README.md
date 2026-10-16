# Deployed-site check (KPI-5, set C)

Measures the response time of the deployed site (Vercel + Supabase cloud) over the internet, signed in as the
author. Read-only: only GET requests to pages, no queue joins, scores, or reports, so no data or LINE message is
created. It does not test capacity; that is the local load test in `../load-test/`.

Pages: `/courts`, `/courts/3x3-a`, `/courts/3x3-b`, `/courts/5x5`, `/profile`, `/teams`, `/calendar`, `/maintenance`,
and with `ADMIN=1` also `/admin`, `/admin/maintenance`, `/admin/maintenance/stats`. Game pages are left out because
they need a game id and the result page expires post-game decisions when read.

## 1. Lighthouse (what a player sees on a phone)

1. Sign in at https://meq-starter-v01.vercel.app in Chrome and open the page to test.
2. F12, tab **Lighthouse**: Mode *Navigation*, Device *Mobile*, Category *Performance* only.
3. Click the gear icon and **untick "Clear storage"**, otherwise Lighthouse signs you out and measures the login page.
4. *Analyze page load*. Three runs per page: `/courts/3x3-a`, `/profile`, `/courts`.
5. Save each report (menu ⋮, *Save as JSON*) into `lighthouse/`, e.g. `courts-3x3-a-1.json`.

Record: Performance score, First Contentful Paint, Largest Contentful Paint, Total Blocking Time, Speed Index.

## 2. k6 (server response time over the internet)

1. In the same signed-in Chrome, F12, tab **Network**, reload the page, click the first request (the page itself),
   *Headers*, *Request Headers*, right-click the value of **Cookie** and copy it. Never paste it into a chat or a file.
2. In PowerShell at the repository root, within a few minutes of copying:

```powershell
$env:MEQ_COOKIE = Get-Clipboard
New-Item -ItemType Directory -Force docs/report/evidence/prod-check/run1 | Out-Null
& "<path to>\k6.exe" run -e OUT=docs/report/evidence/prod-check/run1 docs/report/evidence/prod-check/prod-pages.js
Remove-Item Env:MEQ_COOKIE
```

Add `-e ADMIN=1` if the account is an administrator. Three users browse for three minutes (about 0.7 requests per
second). If the session is not accepted the run stops at once with "Session not accepted". Repeat as `run2`, `run3`.

Output: `runN/pages.txt` (p95 and median per page) and `runN/summary.json`. Neither contains the cookie.

## Results used in the thesis (16 October 2026, 17:44–17:57)

- `run1..3/`: k6, 3 users, 11 pages including the administrator pages; all p95 567 / 506 / 477 ms, 0 failed, every
  request signed in (Table 4.7, rows C1–C3)
- `lighthouse/`: four pages, three runs each, default mobile settings; `summary.txt` lists every run (Table 4.8).
  Lighthouse was run headless through `puppeteer-core` with the cookie set for the MeQ host only
  (`lighthouse-run.mjs`). The JSON files were reduced to the settings, score, and metrics, because the full reports
  embed screenshots and image URLs that show players' LINE names and pictures.
- `first-attempt-session-lost/`: two discarded attempts in which only about 25% of requests were signed in. Cause:
  k6 empties each user's cookie jar between iterations, so the session lasted one round; fixed with `noCookiesReset`.
