# Migration Strategy

## Overview

Xucasa uses Drizzle ORM with PostgreSQL. The single source of truth for the database schema is `shared/schema.ts`. All schema changes flow through this file.

## Migration Approach: Push-Based

This project uses `drizzle-kit push` (not generated migration files) as the primary mechanism for applying schema changes. This means:

- There is no `migrations/` folder with sequential SQL files
- Schema changes are made in `shared/schema.ts` and applied directly to the database
- `drizzle-kit push --force` is used in automated contexts to skip interactive prompts

## When to Use What

| Context | Command | Notes |
|---------|---------|-------|
| Local development | `npx drizzle-kit push` | Interactive, lets you review changes |
| Post-merge (automated) | `npx drizzle-kit push --force` | Non-interactive, auto-approves safe changes |
| Production deploy | `npx drizzle-kit push --force` | Same as post-merge, runs during build |
| Schema drift check | `bash scripts/db-check-drift.sh` | Compares schema.ts against live DB |
| Constraint audit | `bash scripts/db-verify-constraints.sh` | Verifies expected constraints exist |

## Rules

### Always

- Make schema changes in `shared/schema.ts` only
- Run `npx drizzle-kit push` locally after schema changes to verify they apply cleanly
- Test that `npx drizzle-kit push --force` works non-interactively before merging
- Use `.unique()` on column definitions (not standalone index statements) for unique constraints

### Never

- Do not write raw SQL migration files manually
- Do not run `ALTER TABLE` directly in production without also updating `shared/schema.ts`
- Do not use `drizzle-kit push` without `--force` in any automated/CI context
- Do not change primary key column types (serial to varchar or vice versa)
- Do not add `--strict` flag in automated contexts (it forces interactive confirmation)

## Unique Constraints

Drizzle-kit generates unique constraints with a predictable naming pattern: `{table}_{column}_unique`. For example:

- `users.email` with `.unique()` produces `users_email_unique`
- `properties.idx_id` with `.unique()` produces `properties_idx_id_unique`
- `notification_preferences.user_id` with `.unique()` produces `notification_preferences_user_id_unique`

If you add `.unique()` to an existing column that already has data, `drizzle-kit push` will prompt interactively asking whether to truncate the table. The `--force` flag auto-approves data-loss statements but may not suppress all prompts in all drizzle-kit versions. If this occurs:

1. Apply the constraint directly via SQL: `ALTER TABLE {table} ADD CONSTRAINT {table}_{column}_unique UNIQUE ({column});`
2. Verify the constraint name matches Drizzle's expected naming convention
3. Run `npx drizzle-kit push --force` to confirm no remaining drift

## Composite Unique Indexes

For composite unique indexes (e.g., `buyer_interest` on `(property_id, buyer_user_id)`), use Drizzle's table-level index syntax:

```typescript
export const buyerInterest = pgTable("buyer_interest", {
  // columns...
}, (table) => ({
  propertyBuyerIdx: uniqueIndex("buyer_interest_property_buyer_idx").on(table.propertyId, table.buyerUserId),
}));
```

## Post-Merge Flow

`scripts/post-merge.sh` runs automatically after task merges:

1. `npm install` — installs dependencies
2. `drizzle-kit push --force` with a 45-second hard timeout and closed stdin
   - If it completes cleanly → done
   - If it times out (interactive prompt detected) → `scripts/apply-safe-constraints.mjs` runs first to pre-apply constraints via direct SQL, then drizzle-kit push retries
3. Database connectivity verification

### Adding a new constraint that will prompt interactively

Before merging any schema change that adds `.unique()`, `.notNull()`, or changes a column type on a table with existing data:

1. Add an entry to the `CONSTRAINTS` array in `scripts/apply-safe-constraints.mjs`
2. Test locally: `node scripts/apply-safe-constraints.mjs`
3. Then test: `npx drizzle-kit push --force`
4. Merge — post-merge will be clean

## Recovery from Schema Drift

If the database schema has drifted from `shared/schema.ts`:

1. Run `bash scripts/db-check-drift.sh` to identify the drift
2. If drift is due to manual SQL changes, update `shared/schema.ts` to match
3. If drift is due to missing migrations, run `npx drizzle-kit push --force`
4. Run `bash scripts/db-verify-constraints.sh` to confirm constraints are correct
