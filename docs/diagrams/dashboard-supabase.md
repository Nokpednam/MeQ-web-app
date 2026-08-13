# Dashboard Supabase data flow

```mermaid
flowchart LR
    Browser["Authenticated Dashboard request"] --> Page["app/page.tsx"]
    Page --> Auth["Supabase Auth user"]
    Page --> Repository["getSupabaseDashboardData"]
    Repository --> Profile["profiles"]
    Repository --> Courts["courts and queue_entries"]
    Repository --> Games["games"]
    Repository --> History["player_game_history"]
    Repository --> Events["court_events and court_event_courts"]
    Profile --> View["Dashboard UI"]
    Courts --> View
    Games --> View
    History --> View
    Events --> View
    Games --> Active["PLAYING / END_REQUESTED / AWAITING_SCORE"]
    Games --> Recent["COMPLETED only"]
```

The authenticated profile, court state, queue counts, active games, completed
results, and player statistics now share Supabase as their source of truth.
Upcoming court events now come from Supabase. The maintenance-report
development workflow remains separate until its repository is migrated.
