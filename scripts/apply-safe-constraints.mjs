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
  // Backfill: lowercase + en-dash → hyphen for any move_in_timeline values
  // already saved with mixed case or en-dash from prior onboarding flows.
  // Idempotent: WHERE clause matches zero rows after the first run.
  {
    type: 'sql',
    description: 'Normalize existing buyer move_in_timeline values to lowercase ASCII',
    sql: `
      UPDATE buyer_profiles
      SET move_in_timeline = LOWER(REPLACE(move_in_timeline, '–', '-'))
      WHERE move_in_timeline IS NOT NULL
        AND move_in_timeline != LOWER(REPLACE(move_in_timeline, '–', '-'))
    `,
  },
  // Normalize properties.property_type to the buyer-profile vocabulary so
  // Beacon's property-type hard filter actually matches buyers.
  // Buyers select from: Single Family, Condo, Townhouse, Multi-Family, Land, Mobile.
  // The IDX feed uses: SFH, Residential, Townhome, Residential Income, etc.
  // Each WHERE clause makes the UPDATE idempotent — re-runs match zero rows.
  // Values not in the buyer vocab (Commercial, Residential Lease, Farm, etc.)
  // are left untouched intentionally — they aren't matchable buyer types.
  {
    type: 'sql',
    description: 'Normalize property_type: SFH → Single Family',
    sql: `UPDATE properties SET property_type = 'Single Family' WHERE property_type = 'SFH'`,
  },
  {
    type: 'sql',
    description: 'Normalize property_type: Residential → Single Family',
    sql: `UPDATE properties SET property_type = 'Single Family' WHERE property_type = 'Residential'`,
  },
  {
    type: 'sql',
    description: 'Normalize property_type: Townhome → Townhouse',
    sql: `UPDATE properties SET property_type = 'Townhouse' WHERE property_type = 'Townhome'`,
  },
  {
    type: 'sql',
    description: 'Normalize property_type: Residential Income → Multi-Family',
    sql: `UPDATE properties SET property_type = 'Multi-Family' WHERE property_type = 'Residential Income'`,
  },
  {
    type: 'sql',
    description: 'Backfill NULL property_type to Unknown',
    sql: `UPDATE properties SET property_type = 'Unknown' WHERE property_type IS NULL`,
  },
  // Performance indexes (Area 4 audit)
  {
    type: 'sql',
    description: 'Index on properties(status, price)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['properties_status_price_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS properties_status_price_idx ON properties(status, price)`,
  },
  {
    type: 'sql',
    description: 'Index on properties(address_city, address_state)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['properties_city_state_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS properties_city_state_idx ON properties(address_city, address_state)`,
  },
  {
    type: 'sql',
    description: 'Index on properties(beds, baths)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['properties_beds_baths_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS properties_beds_baths_idx ON properties(beds, baths)`,
  },
  {
    type: 'sql',
    description: 'Index on properties(property_type)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['properties_type_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS properties_type_idx ON properties(property_type)`,
  },
  {
    type: 'sql',
    description: 'Index on properties(lat, lng)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['properties_lat_lng_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS properties_lat_lng_idx ON properties(lat, lng)`,
  },
  {
    type: 'sql',
    description: 'Index on properties(price)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['properties_price_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS properties_price_idx ON properties(price)`,
  },
  {
    type: 'sql',
    description: 'Index on saved_properties(user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['saved_properties_user_id_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS saved_properties_user_id_idx ON saved_properties(user_id)`,
  },
  {
    type: 'sql',
    description: 'Index on conversations(buyer_user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['conversations_buyer_user_id_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS conversations_buyer_user_id_idx ON conversations(buyer_user_id)`,
  },
  {
    type: 'sql',
    description: 'Index on conversations(agent_user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['conversations_agent_user_id_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS conversations_agent_user_id_idx ON conversations(agent_user_id)`,
  },
  {
    type: 'sql',
    description: 'Index on messages(conversation_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['messages_conversation_id_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id)`,
  },
  {
    type: 'sql',
    description: 'Index on buyer_profiles(user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['buyer_profiles_user_id_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS buyer_profiles_user_id_idx ON buyer_profiles(user_id)`,
  },
  {
    type: 'sql',
    description: 'Index on users(assigned_agent_user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['users_assigned_agent_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS users_assigned_agent_idx ON users(assigned_agent_user_id)`,
  },
  {
    type: 'sql',
    description: 'Index on users(primary_intent)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['users_primary_intent_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS users_primary_intent_idx ON users(primary_intent)`,
  },
  {
    type: 'sql',
    description: 'Index on buyer_interest(assigned_agent_user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['buyer_interest_agent_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS buyer_interest_agent_idx ON buyer_interest(assigned_agent_user_id)`,
  },
  {
    type: 'sql',
    description: 'Index on notifications(user_id, read)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['notifications_user_read_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read)`,
  },
  {
    type: 'sql',
    description: 'Index on audit_events(actor_user_id)',
    existsCheck: { sql: `SELECT 1 FROM pg_indexes WHERE indexname = $1`, params: ['audit_events_actor_idx'] },
    sql: `CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events(actor_user_id)`,
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
