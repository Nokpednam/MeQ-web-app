# Court queue with Supabase

```mermaid
flowchart TD
  UI["Court queue UI"] --> ACTION["Next.js Server Action"]
  ACTION --> RPC["join_court_queue / leave_court_queue"]
  RPC --> RULES{"Captain, full roster, court type, location, schedule valid?"}
  RULES -- No --> ERROR["Translated queue error"]
  RULES -- Yes --> TX["PostgreSQL transaction"]
  TX --> ENTRY["Queue entry and position"]
  TX --> PLAYERS["Reserve every player in active_queue_players"]
  ENTRY --> REFRESH["Revalidate all court views"]
  PLAYERS --> REFRESH
```

`active_queue_players.user_id` and the partial unique team index prevent a team
or player from becoming active on more than one court. Queue order is recalculated
inside PostgreSQL when a waiting team leaves.
