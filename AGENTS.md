# MeQ repository instructions

## Product context
MeQ is a Thai-language web application for basketball-court queues, game scoring, player statistics, court calendars, and maintenance reports at Naresuan University.

## Non-negotiable business rules
- Courts are `3x3 A`, `3x3 B`, and `5x5`; each has its own queue.
- 3x3 A and 3x3 B share the current daily target-score setting.
- A user may belong to exactly one team at a time.
- A 3x3 team has at most 3 members; a 5x5 team has at most 5 members.
- A team can enter a queue only when its roster is full.
- A team/player cannot be active in more than one queue.
- Winners may stay for 2 consecutive wins, rest for 1 game on the same court, then return immediately.
- Losers have 3 minutes to requeue; no response means leave the queue.
- Never trust client-side timers, positions, roles, or scores; validate on the server/database.

## Engineering rules
- Use TypeScript strict mode and Next.js App Router.
- Keep business rules in `lib/` rather than UI components.
- Use PostgreSQL transactions for queue transitions and game finalization.
- Add or update Mermaid diagrams in `docs/diagrams` when behavior changes.
- Add database constraints for one active membership and one active queue per team/player.
- Never expose service-role keys to the browser.
- UI copy should be Thai; code identifiers and comments should be clear English.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` after code changes.
