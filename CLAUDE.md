# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This is the owner's university final-year project (Naresuan University). Current feature status, in-progress work, and next steps live in `PROGRESS.md`: read it at the start of a session and update it when a piece of work is finished.

Working rules for this repo: never push to `main` or touch production directly; ask before applying migrations to the remote Supabase project; keep secrets out of code and chat.

`AGENTS.md` (imported above) holds the non-negotiable business rules and engineering rules. Treat it as authoritative. It also warns that this is Next.js 16: read `node_modules/next/dist/docs/` before using unfamiliar Next.js APIs. For example, request middleware lives in `proxy.ts` (exporting `proxy`), not `middleware.ts`.

## Commands

```bash
npm run dev            # Next.js dev server on http://localhost:3000
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run build          # production build
npm run test:unit      # all TypeScript rule tests (runs the four suites below)
npm run test:game-lifecycle | test:admin | test:team-location | test:production-surface
npm run test:db        # pgTAP tests in supabase/tests (needs Docker + local Supabase)
```

Required after every code change: `typecheck`, `lint`, `build`. CI (`.github/workflows/ci.yml`) also runs `test:unit` and `supabase test db` on pushes and PRs to `main`.

Unit tests are not run with a test framework. `tsconfig.game-tests.json` compiles `tests/**/*.test.ts` plus `lib/**/*.ts` to CommonJS in `.next/meq-game-tests/`, and then `node --test` runs the output. To run a single test, compile first and filter by name:

```bash
npx tsc -p tsconfig.game-tests.json && node --test --test-name-pattern="<test name>" .next/meq-game-tests/tests/<file>.test.js
```

A new test file needs a matching `test:*` script in `package.json`, and that script must be added to `test:unit`. Because the compiled tests use plain `tsc`, code under `lib/` that they import cannot depend on the `@/` path alias or on Next-only modules.

Database tests:

```bash
npx supabase start
npx supabase db reset --local --no-seed   # re-apply all migrations
npm run test:db
```

Render Mermaid diagrams to SVG: `./scripts/render-diagrams.sh` (bash).

## Architecture

**PostgreSQL is the source of truth for all lifecycle state.** Team membership, queue position, check-in deadlines, games, score submissions, and player history are changed only through `SECURITY DEFINER` RPC functions in `supabase/migrations/`. Those functions check `auth.uid()` and the caller's role inside a transaction, set an empty `search_path`, and use schema-qualified names. RLS and column grants block direct client writes to lifecycle tables. Scheduled database jobs (pg_cron) handle expiries such as check-in and requeue timeouts. Browser timers are for display only.

Request flow for a mutation:
`components/*` (client UI) → `app/<route>/actions.ts` (`"use server"` Server Action: parses `FormData`, validates input, calls `supabase.rpc(...)`, maps error codes to `?error=` redirects, then calls `revalidatePath`) → RPC in a migration.

Request flow for reads:
`app/<route>/page.tsx` (Server Component) → `lib/supabase-*-repository.ts` (`import "server-only"`; queries tables with the session client and maps snake_case rows to camelCase domain types from `lib/*-types.ts`).

Key pieces of `lib/`:
- `lib/supabase/`: `server.ts` creates the cookie-based server client using the publishable key. `client.ts` is the browser client. `proxy.ts` (`updateSession`) refreshes the session from root `proxy.ts`. `authenticated-user.ts` provides `getAuthenticatedUser`, which is `react` `cache`d so layouts and pages share one auth lookup per request.
- `*-rules.ts`: pure business-rule helpers (queue, team, game lifecycle, check-in, admin, location) that the Node tests cover.
- `*-translations.ts` / `*-error-copy.ts`: UI copy in `th` and `en`. Thai is the default. The selected language lives only in `localStorage` (`meq-language`) through `components/use-meq-language.ts`. That is the only allowed use of browser storage.

Domain details that span files:
- Court IDs are `3x3-a`, `3x3-b`, and `5x5`. Both 3x3 courts belong to one `court_group`, and the daily target score is stored per court group and business date. Queue entries are stored per court.
- The business date uses `Asia/Bangkok` and rolls over at 05:00. Courts are open 05:00–00:00.
- Games snapshot the roster and target score, so later changes do not rewrite past results.
- GPS check-in: the browser sends coordinates to a server action, and the database computes the distance and stores an expiring verification. Never accept a client-side "in range" flag. Team-ready confirmation applies a stricter distance check than browser verification, so review the two together.
- Maintenance images go to the private Storage bucket `maintenance-evidence` at `<userId>/<uuid>.<ext>`. Only the object path is stored in the database.
- Admin is `profiles.role = 'ADMIN'`, and every admin RPC checks it again.

`tests/production-surface.test.ts` checks the source code itself. It asserts that removed localStorage simulator files stay deleted and that certain CSS and nav patterns hold. Expect it to fail if you reintroduce client-side lifecycle state.

## Database change checklist

- Add a new timestamped migration in `supabase/migrations/`. Never edit an applied one.
- Add or extend pgTAP coverage in `supabase/tests/`. `security_privileges.sql` covers grants and RLS.
- Update the matching diagram in `docs/diagrams/` (`.mmd` or `.md`) and, if needed, `docs/requirements/queue-rules.md` and `docs/architecture/supabase-foundation.md`.

## Environment

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL`. LINE Login is configured in Supabase as the custom OAuth provider `custom:line`. A database trigger copies LINE display name and avatar into `profiles`. The LINE Messaging variables in `.env.example` are placeholders, and the app does not read them yet. Supabase Realtime is not used.
