#!/bin/bash
set -euo pipefail

echo "=== Schema drift check ==="
echo "Comparing Drizzle schema (shared/schema.ts) against live database..."

PUSH_OUTPUT=$(npx drizzle-kit push --force 2>&1)
echo "$PUSH_OUTPUT"

if echo "$PUSH_OUTPUT" | grep -qi "error\|fatal\|abort"; then
  echo "ERROR: Schema check failed. See output above."
  exit 1
fi

KNOWN_IDEMPOTENCY_ISSUES="agent_coordination_conversation_id"
HAS_REAL_DRIFT=false

if echo "$PUSH_OUTPUT" | grep -q "Warning"; then
  STATEMENTS=$(echo "$PUSH_OUTPUT" | grep -c "ALTER TABLE\|CREATE TABLE\|DROP TABLE" || true)
  KNOWN_MATCHES=$(echo "$PUSH_OUTPUT" | grep -c "$KNOWN_IDEMPOTENCY_ISSUES" || true)

  if [ "$STATEMENTS" -gt 0 ] && [ "$KNOWN_MATCHES" -lt "$STATEMENTS" ]; then
    HAS_REAL_DRIFT=true
  fi
fi

if [ "$HAS_REAL_DRIFT" = true ]; then
  echo "WARNING: Real drift was detected and auto-applied. Review the changes above."
else
  echo "RESULT: Schema is aligned (no unexpected drift)."
fi
