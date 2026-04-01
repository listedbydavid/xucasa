# Deployment Database Runbook

## Pre-Deployment Checklist

Before deploying any change that modifies `shared/schema.ts`:

1. Verify schema changes apply cleanly in dev: `npx drizzle-kit push`
2. Verify non-interactive mode works: `npx drizzle-kit push --force`
3. Run constraint verification: `bash scripts/db-verify-constraints.sh`
4. Run drift check: `bash scripts/db-check-drift.sh`

## Deployment Order of Operations

1. Code is merged to main
2. `scripts/post-merge.sh` runs automatically:
   - Installs dependencies
   - Pushes schema changes via `drizzle-kit push --force`
   - Verifies database connectivity
3. Application workflow restarts
4. Verify the application starts and serves requests

## Handling Schema Change Failures

### Symptom: Post-merge hangs

**Root cause:** `drizzle-kit push` is prompting interactively (e.g., asking about truncation for a new unique constraint on an existing table with data).

**Fix:**
1. Apply the constraint manually via SQL:
   ```sql
   ALTER TABLE {table} ADD CONSTRAINT {table}_{column}_unique UNIQUE ({column});
   ```
2. Re-run: `npx drizzle-kit push --force`
3. Confirm: output shows "Changes applied" or "No changes detected"

### Symptom: Constraint already exists error

**Root cause:** A unique index exists with the same name as the constraint Drizzle is trying to create, but PostgreSQL sees it as an index not a constraint.

**Fix:**
1. Drop the index: `DROP INDEX IF EXISTS {constraint_name};`
2. Add as a proper constraint: `ALTER TABLE {table} ADD CONSTRAINT {constraint_name} UNIQUE ({column});`
3. Re-run: `npx drizzle-kit push --force`

### Symptom: Data violates new unique constraint

**Root cause:** Existing rows have duplicate values in the column being constrained.

**Fix:**
1. Identify duplicates:
   ```sql
   SELECT {column}, count(*) FROM {table} GROUP BY {column} HAVING count(*) > 1;
   ```
2. Resolve duplicates (delete or update)
3. Apply the constraint

## Adding Unique Constraints Safely

When adding `.unique()` to a column in `shared/schema.ts` that already has data:

1. Check for duplicates first (see above)
2. If no duplicates, apply directly via `drizzle-kit push` (interactive) or SQL
3. If duplicates exist, resolve them before applying
4. After applying, run `bash scripts/db-verify-constraints.sh` to confirm

## Rollback Procedure

If a schema change causes application failures after deployment:

1. Revert the `shared/schema.ts` change in code
2. Run `npx drizzle-kit push --force` to re-sync (only works for additive changes)
3. For destructive changes (dropped columns), restore from database backup
4. For constraint removals: `ALTER TABLE {table} DROP CONSTRAINT {name};`

## Emergency Direct SQL

If you must run SQL directly against the database:

1. Document what you ran and why
2. Update `shared/schema.ts` to reflect the change
3. Run `npx drizzle-kit push --force` to verify alignment
4. Run `bash scripts/db-verify-constraints.sh` to verify constraints
5. Commit the schema.ts change

Direct SQL without updating schema.ts creates drift and will cause problems on the next push.
