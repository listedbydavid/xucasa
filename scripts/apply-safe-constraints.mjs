/**
 * apply-safe-constraints.mjs
 *
 * Pre-flight SQL applicator for constraints that cause drizzle-kit to prompt
 * interactively. This script applies known constraints idempotently via direct
 * SQL before drizzle-kit push runs, so drizzle-kit finds them already in place
 * and skips the prompt entirely.
 *
 * Add new entries to CONSTRAINTS array whenever a schema change would cause
 * a drizzle-kit interactive prompt (unique constraints on existing data,
 * not-null additions, etc.)
 */

import pg from 'pg';

const client = new pg.Client(process.env.DATABASE_URL);

// Each entry is applied idempotently — safe to run multiple times.
// type: 'unique'        → ADD CONSTRAINT ... UNIQUE
// type: 'unique_partial'→ CREATE UNIQUE INDEX ... WHERE condition (for nullable columns)
// type: 'not_null'      → ALTER COLUMN ... SET NOT NULL (checks for nulls first)
// type: 'sql'           → raw SQL, use for anything else
const CONSTRAINTS = [
  // Example — already applied, kept here as idempotent record:
  {
    type: 'unique',
    table: 'users',
    column: 'email',
    constraint: 'users_email_unique',
  },
  {
    type: 'unique',
    table: 'properties',
    column: 'idx_id',
    constraint: 'properties_idx_id_unique',
  },
  {
    type: 'unique',
    table: 'notification_preferences',
    column: 'user_id',
    constraint: 'notification_preferences_user_id_unique',
  },
  // Composite unique index — buyer_interest
  {
    type: 'sql',
    description: 'buyer_interest composite unique index',
    existsCheck: {
      sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`,
      params: ['buyer_interest_property_buyer_idx'],
    },
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS buyer_interest_property_buyer_idx
      ON buyer_interest (property_id, buyer_user_id);
    `,
  },
  // Normalize move_in_timeline en-dash (–) to ASCII hyphen (-)
  // The WHERE clause makes this idempotent — re-runs match zero rows.
  {
    type: 'sql',
    description: 'Normalize move_in_timeline en-dash to hyphen',
    sql: `UPDATE buyer_profiles SET move_in_timeline = REPLACE(move_in_timeline, '–', '-') WHERE move_in_timeline LIKE '%–%'`,
  },
];

async function applyConstraints() {
  await client.connect();
  console.log('Applying pre-flight constraints...');

  for (const entry of CONSTRAINTS) {
    try {
      if (entry.type === 'unique') {
        // Check if constraint already exists — skip if so
        const exists = await client.query(`
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = $1
            AND table_name = $2
            AND constraint_type = 'UNIQUE'
        `, [entry.constraint, entry.table]);

        if (exists.rows.length > 0) {
          console.log(`  ✓ Already exists: ${entry.constraint}`);
          continue;
        }

        // Check for duplicates before applying
        const dupes = await client.query(`
          SELECT ${entry.column}, count(*) as cnt
          FROM ${entry.table}
          WHERE ${entry.column} IS NOT NULL
          GROUP BY ${entry.column}
          HAVING count(*) > 1
        `);

        if (dupes.rows.length > 0) {
          console.error(`  ✗ Cannot apply ${entry.constraint}: duplicate values exist:`);
          console.error(dupes.rows);
          process.exit(1);
        }

        await client.query(`
          ALTER TABLE ${entry.table}
          ADD CONSTRAINT ${entry.constraint} UNIQUE (${entry.column})
        `);
        console.log(`  ✓ Applied: ${entry.constraint}`);

      } else if (entry.type === 'unique_partial') {
        const exists = await client.query(`
          SELECT 1 FROM pg_indexes
          WHERE indexname = $1
        `, [entry.constraint]);

        if (exists.rows.length > 0) {
          console.log(`  ✓ Already exists: ${entry.constraint}`);
          continue;
        }

        await client.query(`
          CREATE UNIQUE INDEX ${entry.constraint}
          ON ${entry.table} (${entry.column})
          WHERE ${entry.whereClause}
        `);
        console.log(`  ✓ Applied partial index: ${entry.constraint}`);

      } else if (entry.type === 'not_null') {
        const colInfo = await client.query(`
          SELECT is_nullable FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [entry.table, entry.column]);

        if (colInfo.rows.length === 0) {
          console.error(`  ✗ Cannot apply NOT NULL on ${entry.table}.${entry.column}: column does not exist`);
          process.exit(1);
        }

        if (colInfo.rows[0].is_nullable === 'NO') {
          console.log(`  ✓ Already NOT NULL: ${entry.table}.${entry.column}`);
          continue;
        }

        const nulls = await client.query(`
          SELECT count(*) AS cnt FROM ${entry.table} WHERE ${entry.column} IS NULL
        `);

        if (parseInt(nulls.rows[0].cnt, 10) > 0) {
          console.error(`  ✗ Cannot apply NOT NULL on ${entry.table}.${entry.column}: ${nulls.rows[0].cnt} null rows exist`);
          process.exit(1);
        }

        await client.query(`
          ALTER TABLE ${entry.table} ALTER COLUMN ${entry.column} SET NOT NULL
        `);
        console.log(`  ✓ Applied NOT NULL: ${entry.table}.${entry.column}`);

      } else if (entry.type === 'sql') {
        if (entry.existsCheck) {
          const exists = await client.query(entry.existsCheck.sql, entry.existsCheck.params || []);
          if (exists.rows.length > 0) {
            console.log(`  ✓ Already exists: ${entry.description}`);
            continue;
          }
        }
        await client.query(entry.sql);
        console.log(`  ✓ Applied: ${entry.description}`);
      }

    } catch (err) {
      console.error(`  ✗ Failed on ${entry.constraint || entry.description}: ${err.message}`);
      process.exit(1);
    }
  }

  await client.end();
  console.log('Pre-flight constraints complete.');
}

applyConstraints().catch(e => {
  console.error('Fatal error in apply-safe-constraints:', e.message);
  process.exit(1);
});
