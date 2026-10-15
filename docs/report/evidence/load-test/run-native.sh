#!/usr/bin/env bash
# Three independent load runs on the LOCAL stack: reset the local database, seed, run k6, check invariants.
set -u
L="C:/Users/riwza/AppData/Local/Temp/claude/D--MeQ-meq-starter-v0-1/b0a12002-e11a-4a79-9e1d-a22a4e5f1ecc/scratchpad/load"
REPO="D:/MeQ/meq-load"
export SUPABASE_SECRET_KEY="$(cd "$REPO" && npx supabase status -o env 2>/dev/null | sed -n 's/^SECRET_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
K6="C:/Users/riwza/AppData/Local/Temp/claude/D--MeQ-meq-starter-v0-1/b0a12002-e11a-4a79-9e1d-a22a4e5f1ecc/scratchpad/k6bin/k6-v2.3.0-windows-amd64/k6.exe"
for run in 1 2 3; do
  echo "=== RUN $run start $(date -u +%H:%M:%S)"
  (cd "$REPO" && npx supabase db reset --local --no-seed >/dev/null 2>&1) || { echo "RUN $run reset FAILED"; exit 1; }
  node "$L/seed-users.cjs" "$REPO" || { echo "RUN $run seed users FAILED"; exit 1; }
  docker exec -i supabase_db_meq-starter-v0.1 psql -U postgres -v ON_ERROR_STOP=1 -q < "$L/seed-teams.sql" >/dev/null || { echo "RUN $run seed teams FAILED"; exit 1; }
  mkdir -p "$L/native-run$run"
  APP=http://localhost:3100 SB=http://127.0.0.1:54321 OUT="$L/native-run$run" "$K6" run --quiet "$L/meq-load.js" > "$L/native-run$run/k6.log" 2>&1
  echo "RUN $run k6 exit $?"
  docker exec -i supabase_db_meq-starter-v0.1 psql -U postgres -q < "$L/invariants.sql" > "$L/native-run$run/invariants.txt" 2>&1
  grep -E "^ I[0-9]" "$L/native-run$run/invariants.txt"
  echo "=== RUN $run end $(date -u +%H:%M:%S)"
done
echo "ALL DONE"
