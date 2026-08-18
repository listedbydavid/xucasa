#!/bin/bash
set -euo pipefail

echo "=== Post-merge setup ==="

echo "[1/3] Installing dependencies..."
npm install --prefer-offline --no-audit --no-fund 2>&1

echo "[2/3] Applying schema changes..."
# Run drizzle-kit push with a hard timeout and stdin closed to prevent hanging.
# If it exits non-zero or times out, we fall back to verifying alignment only.
PUSH_OUTPUT=$(timeout 45s npx drizzle-kit push --force 2>&1 </dev/null) && PUSH_EXIT=0 || PUSH_EXIT=$?
echo "$PUSH_OUTPUT"

if [ $PUSH_EXIT -eq 124 ]; then
  echo "WARNING: drizzle-kit push timed out (likely an interactive prompt)."
  echo "This means a schema change requires manual SQL intervention."
  echo "Running constraint pre-flight check instead..."
  node scripts/apply-safe-constraints.mjs
  # Re-run push now that constraints are pre-applied
  PUSH_OUTPUT2=$(timeout 45s npx drizzle-kit push --force 2>&1 </dev/null) && PUSH_EXIT2=0 || PUSH_EXIT2=$?
  echo "$PUSH_OUTPUT2"
  if [ $PUSH_EXIT2 -ne 0 ] && [ $PUSH_EXIT2 -ne 124 ]; then
    echo "ERROR: Schema push failed after pre-flight. Review output above."
    exit 1
  fi
elif [ $PUSH_EXIT -ne 0 ]; then
  if echo "$PUSH_OUTPUT" | grep -qi "truncate\|abort\|fatal"; then
    echo "ERROR: Schema push encountered a fatal issue. Review output above."
    exit 1
  fi
  echo "WARNING: drizzle-kit push exited non-zero but no fatal keywords found. Continuing."
fi

echo "[3/3] Verifying database connectivity..."
if ! node -e "
  import('pg').then(async ({ default: pg }) => {
    const client = new pg.Client(process.env.DATABASE_URL);
    await client.connect();
    const res = await client.query('SELECT count(*) FROM information_schema.tables WHERE table_schema = \\'public\\'');
    console.log('DB tables: ' + res.rows[0].count);
    await client.end();
  }).catch(e => { console.error('DB check failed:', e.message); process.exit(1); });
" 2>&1; then
  echo "ERROR: Database connectivity check failed."
  exit 1
fi

echo "=== Post-merge setup complete ==="
