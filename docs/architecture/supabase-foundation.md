# Supabase foundation for MeQ

## Current implementation

The deployed application uses Supabase Auth, PostgreSQL, Storage, RLS policies, and PostgreSQL RPC functions. Dashboard, team, queue, GPS check-in, game, score, statistics, calendar, admin, and maintenance pages read or change Supabase data.

The application does not currently subscribe to Supabase Realtime. LINE Login is implemented. LINE Messaging push notifications use a database outbox with delivery tracking (see `line-notifications.md`); webhook handling is not implemented.

## Source of truth

- `profiles` references `auth.users` and stores the `USER` or `ADMIN` role.
- `team_memberships` stores team membership. A partial unique index limits a user to one active team.
- `queue_entries` stores queue state. `active_queue_players` prevents a player from being active in multiple queues.
- `games` stores active and completed games. `courts.active_game_id` points to the current game.
- `score_submissions` is unique by `(game_id, team_id)`. `player_scores` uses the game's roster snapshot.
- `player_game_history` is unique by `(game_id, user_id)`. `player_statistics` calculates separate 3x3 and 5x5 totals.
- `maintenance_reports.image_path` stores a private Storage object path rather than image data.

## Authentication and authorization

Next.js uses the Supabase publishable key and session cookies. LINE Login is configured as the Supabase custom OAuth provider `custom:line`.

Lifecycle tables use RLS. Client writes to team, queue, game, and score state go through database RPC functions that check `auth.uid()`, membership, captain status, or admin role as required. Security-definer functions set an empty search path and use schema-qualified object names.

The application does not expose a service-role key to browser code. Admin role assignment is not part of the normal profile update path.

RLS policies that call helper functions (`private.is_admin()`, `private.is_active_team_member()`) need the `authenticated` role to have `USAGE` on the `private` schema and `EXECUTE` on those helpers; without it every direct read of the table fails with `permission denied for function`. Both helpers are security definer and only answer a yes/no question about the caller. pgTAP tests run as `postgres`, which bypasses RLS, so a policy is only tested when the test switches to `set local role authenticated` (see `rls_helper_access.sql`).

## Location boundary

The browser obtains coordinates from the device and sends them to a Next.js server action. The server action calls a database function that calculates the distance and stores an expiring verification. The database does not accept a client-provided `in_range` boolean.

This verifies distance from the submitted coordinates, but it does not prove that a device has not spoofed its location. GPS checks should therefore be treated as an admission control for normal users, not as tamper-proof evidence.

Browser verification and team-ready confirmation both accept the configured court radius (`courts.location_radius_metres`). A missing or expired verification at team-ready reports `LOCATION_VERIFICATION_REQUIRED`.

## Business date and time

Courts operate from 05:00 to 00:00 in `Asia/Bangkok`. The business date changes at 05:00.

Target scores are stored by `court_group_id` and business date. The 3x3 A and 3x3 B courts use the same `3x3` group for target scores but retain separate queue entries.

## Transaction boundary

- Server Components read data with the current session and publishable key.
- Team, queue, game, and score transitions use PostgreSQL RPC functions.
- Database timestamps own check-in and requeue deadlines.
- Scheduled database jobs process expired states.
- Game finalization writes result and player history in a transaction.
- The production component tree does not use a local lifecycle provider or browser storage as a database substitute.
- Browser storage is used only to remember the selected language.

## Environment variables

The current application runtime reads:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

LINE Login credentials are configured in Supabase and LINE Developers. LINE Messaging uses the server-only variables `LINE_MESSAGING_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and `LINE_DISPATCH_SECRET`; see `line-notifications.md`.

## Database test coverage

The pgTAP suite covers database privileges, team membership, location status, queue operations, and a full 3x3 flow. Unit tests cover lifecycle rule helpers and production-surface checks.

Still required for integration confidence:

- two captains confirming ready at the same time
- concurrent join, leave, call, and requeue operations
- the complete winner hold, rest, and return flow in production SQL
- invalid-score resubmission by both teams
- negative RLS tests with separate authenticated users for the remaining tables (`rls_helper_access.sql` covers history, scores, submissions, maintenance reports, and audit logs)
- browser tests for LINE callback and session handling
- LINE webhook signature, duplicate-event, retry, and delivery tests after Messaging is implemented

Changes to locking, lifecycle transitions, RLS, authentication, scoring, or LINE integration should wait for the related multi-user tests.
