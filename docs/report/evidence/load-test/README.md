# Load test evidence (KPI-1, KPI-5), 16 October 2026

Run on the LOCAL Supabase stack and a local production build only; no production data was touched.

- `seed-users.cjs`, `seed-teams.sql`: 50 test accounts (local demo keys and a test password), 10 teams of 3 and 4 of 5
- `meq-load.js`: k6 script (k6 v2.3.0; `OUT`, `APP`, `SB` select the output folder and targets), 50 virtual users, 30 s ramp-up, 3 min hold
- `invariants.sql`: nine queue invariants checked after each run (all must be 0)
- `run-all.sh`: set A, k6 in the `grafana/k6` Docker container; reset, seed, run, check; three independent runs
- `run-native.sh`: set B, the same k6 v2.3.0 run directly on Windows against `localhost`, added to find the cause of set A's failed requests
- `setA-run1..3/`, `setB-run1..3/`: results used in the thesis (Tables 4.3 and 4.7)
- `first-attempt/`: the first set of runs, before two instrument errors were fixed (HTTP 204 from `leave_court_queue` counted as a failure; cleared positions of called teams counted as violations)
