# Schema Drift Policy

## Definition

Schema drift occurs when the live database schema does not match the Drizzle schema defined in `shared/schema.ts`. This can happen when:

- Direct SQL is run against the database without updating schema.ts
- A migration partially applies (e.g., constraint added but column type not changed)
- Multiple branches modify schema.ts and merge in unexpected order
- Interactive prompts in drizzle-kit are skipped or answered incorrectly

## Detection

### Automated (post-merge)

The `scripts/post-merge.sh` script runs `drizzle-kit push --force` on every merge. If there are schema differences, they are automatically applied. The output is logged.

### Manual

Run these scripts to check for drift:

```bash
bash scripts/db-check-drift.sh        # Full schema comparison
bash scripts/db-verify-constraints.sh  # Constraint-specific check
```

### What to look for

- `drizzle-kit push` output showing "Changes applied" when no schema.ts changes were made = drift existed
- Missing constraints in `db-verify-constraints.sh` output
- Application errors related to missing columns or constraints

## Prevention

1. All schema changes go through `shared/schema.ts` — no exceptions
2. Never run `ALTER TABLE`, `CREATE INDEX`, `DROP` etc. directly without also updating schema.ts
3. When resolving interactive prompts during local development, always verify the result with `drizzle-kit push --force` afterward
4. When a task agent modifies schema.ts, the post-merge script auto-applies changes

## Recovery

### Drift from direct SQL (DB has changes not in schema.ts)

1. Identify what changed: `bash scripts/db-check-drift.sh`
2. Update `shared/schema.ts` to match the current DB state
3. Run `npx drizzle-kit push --force` to verify alignment (should show no changes)
4. Commit the schema.ts update

### Drift from schema.ts change not applied to DB

1. Run `npx drizzle-kit push --force`
2. If it prompts interactively (shouldn't with --force), apply via SQL
3. Run `bash scripts/db-verify-constraints.sh`
4. Verify application starts correctly

### Constraint naming mismatch

Drizzle expects constraints named `{table}_{column}_unique`. If a constraint exists with a different name:

1. Drop the misnamed constraint/index
2. Re-create with the correct name
3. Run `npx drizzle-kit push --force` to confirm alignment

## Current Verified State

As of the last audit, these unique constraints are verified aligned:

| Table | Constraint | Column |
|-------|-----------|--------|
| users | users_email_unique | email |
| properties | properties_idx_id_unique | idx_id |
| notification_preferences | notification_preferences_user_id_unique | user_id |

Additionally, `buyer_interest` has a composite unique index `buyer_interest_property_buyer_idx` on `(property_id, buyer_user_id)`.

## Known Idempotency Issue

The `buyer_interest.agent_coordination_conversation_id` foreign key has a generated constraint name that exceeds PostgreSQL's 63-character identifier limit:

- Drizzle expects: `buyer_interest_agent_coordination_conversation_id_conversations_id_fk` (69 chars)
- Postgres stores: `buyer_interest_agent_coordination_conversation_id_conversations` (63 chars, truncated)

This causes `drizzle-kit push` to re-apply the FK rename on every run (drop truncated, add full-length, Postgres truncates again). This is a known drizzle-kit limitation with very long auto-generated FK names.

**Impact:** None. The FK is functionally correct. The drift check script (`db-check-drift.sh`) explicitly accounts for this and does not report it as unexpected drift.

**Permanent fix (if desired):** Rename the column `agentCoordinationConversationId` to something shorter (e.g., `agentCoordConvoId`) so the generated FK name fits within 63 characters. This would require a schema migration and storage layer update.
