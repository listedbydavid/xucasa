#!/bin/bash
set -euo pipefail

echo "=== Constraint verification ==="
echo "Checking all UNIQUE and PRIMARY KEY constraints..."

RESULT=$(psql "$DATABASE_URL" -t -A -c "
SELECT tc.table_name || '.' || tc.constraint_name || ' (' || tc.constraint_type || ': ' || kcu.column_name || ')'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('UNIQUE','PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
")

echo "$RESULT"
echo ""

UNIQUE_COUNT=$(echo "$RESULT" | grep -c "UNIQUE" || true)
PK_COUNT=$(echo "$RESULT" | grep -c "PRIMARY KEY" || true)
echo "Summary: $PK_COUNT primary keys, $UNIQUE_COUNT unique constraints"

EXPECTED_UNIQUES="users.users_email_unique properties.properties_idx_id_unique notification_preferences.notification_preferences_user_id_unique"
MISSING=0
for EXPECTED in $EXPECTED_UNIQUES; do
  TABLE=$(echo "$EXPECTED" | cut -d. -f1)
  CONSTRAINT=$(echo "$EXPECTED" | cut -d. -f2)
  if ! echo "$RESULT" | grep -q "$CONSTRAINT"; then
    echo "MISSING: $TABLE.$CONSTRAINT"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  echo "ERROR: One or more expected constraints are missing."
  exit 1
fi

echo "All expected unique constraints verified."
