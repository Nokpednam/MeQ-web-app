#!/usr/bin/env bash
# Three independent load runs on the LOCAL stack: reset the local database, seed, run k6, check invariants.
set -u
L="C:/Users/riwza/AppData/Local/Temp/claude/D--MeQ-meq-starter-v0-1/b0a12002-e11a-4a79-9e1d-a22a4e5f1ecc/scratchpad/load"
REPO="D:/MeQ/meq-load"
export SUPABASE_SECRET_KEY="$(cd "$REPO" && npx supabase status -o env 2>/dev/null | sed -n 's/^SECRET_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
for run in 1 2 3; do
  echo "=== RUN $run start $(date -u +%H:%M:%S)"
  (cd "$REPO" && npx supabase db reset --local --no-seed >/dev/null 2>&1) || { echo "RUN $run reset FAILED"; exit 1; }
  node "$L/seed-users.cjs" "$REPO" || { echo "RUN $run seed users FAILED"; exit 1; }
  docker exec -i supabase_db_meq-starter-v0.1 psql -U postgres -v ON_ERROR_STOP=1 -q < "$L/seed-teams.sql" >/dev/null || { echo "RUN $run seed teams FAILED"; exit 1; }
  mkdir -p "$L/out-run$run"
  MSYS_NO_PATHCONV=1 docker run --rm -v "$L:/scripts:ro" -v "$L/out-run$run:/out" grafana/k6 run --quiet /scripts/meq-load.js > "$L/out-run$run/k6.log" 2>&1
  echo "RUN $run k6 exit $?"
  docker exec -i supabase_db_meq-starter-v0.1 psql -U postgres -q < "$L/invariants.sql" > "$L/out-run$run/invariants.txt" 2>&1
  grep -E "^ I[0-9]" "$L/out-run$run/invariants.txt"
  echo "=== RUN $run end $(date -u +%H:%M:%S)"
done
echo "ALL DONE"
