#!/bin/bash
set -euo pipefail

echo "=== Post-merge setup ==="

echo "[1/3] Installing dependencies..."
npm install --prefer-offline --no-audit --no-fund 2>&1

echo "[2/3] Checking schema drift..."
DRIFT_OUTPUT=$(npx drizzle-kit push --force 2>&1)
echo "$DRIFT_OUTPUT"

if echo "$DRIFT_OUTPUT" | grep -qi "truncate\|abort\|error\|fatal"; then
  echo "ERROR: Schema push encountered issues. Review output above."
  exit 1
fi

echo "[3/3] Verifying database connectivity..."
if ! node -e "
  import('pg').then(async ({ default: pg }) => {
    const client = new pg.Client(process.env.DATABASE_URL);
    await client.connect();
    const res = await client.query('SELECT count(*) FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log('DB tables: ' + res.rows[0].count);
    await client.end();
  }).catch(e => { console.error('DB check failed:', e.message); process.exit(1); });
" 2>&1; then
  echo "ERROR: Database connectivity check failed."
  exit 1
fi

echo "=== Post-merge setup complete ==="
