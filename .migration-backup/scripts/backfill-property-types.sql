-- One-time backfill for properties.property_type so Beacon's hard filter
-- on home_types stops dropping legitimate buyer matches.
--
-- Run order matters: most specific normalisations first, then a default
-- of 'SFH' for any remaining active rows so they participate in matching.
-- Re-running this script is safe (each statement is idempotent).
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/backfill-property-types.sql

BEGIN;

-- Single-family + generic "Residential"/lease rows from MLS feeds
UPDATE properties SET property_type = 'SFH'
 WHERE LOWER(COALESCE(property_type, '')) IN (
   'residential',
   'residential lease',
   'single family',
   'single-family',
   'single family home',
   'single family residential',
   'single-family residential',
   'detached'
 );

-- Small multi-unit
UPDATE properties SET property_type = '2-4 Unit'
 WHERE LOWER(COALESCE(property_type, '')) IN (
   'residential income',
   'duplex',
   'triplex',
   'fourplex',
   'quadruplex'
 );

-- Commercial subtype rollup
UPDATE properties SET property_type = 'Commercial'
 WHERE LOWER(COALESCE(property_type, '')) IN ('commercial sale');

-- Farm vs. Farm/Ranch
UPDATE properties SET property_type = 'Farm/Ranch'
 WHERE LOWER(COALESCE(property_type, '')) = 'farm';

-- Townhome spelling variants
UPDATE properties SET property_type = 'Townhome'
 WHERE LOWER(COALESCE(property_type, '')) IN ('townhouse', 'town home', 'town house');

-- Condo spelling variants
UPDATE properties SET property_type = 'Condo'
 WHERE LOWER(COALESCE(property_type, '')) IN ('condominium');

-- Land/lot variants
UPDATE properties SET property_type = 'Land'
 WHERE LOWER(COALESCE(property_type, '')) IN ('lot', 'vacant land', 'vacant lot');

-- Mobile / manufactured
UPDATE properties SET property_type = 'Mobile'
 WHERE LOWER(COALESCE(property_type, '')) IN ('manufactured', 'mobile home', 'manufactured home');

-- Default any remaining NULL/blank ACTIVE listings to SFH so the Beacon
-- hard filter does not exclude them. Inactive/removed rows are left as-is.
UPDATE properties SET property_type = 'SFH'
 WHERE status = 'active'
   AND (property_type IS NULL OR TRIM(property_type) = '');

-- Verification: must return 0
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
    FROM properties
   WHERE status = 'active'
     AND (property_type IS NULL OR TRIM(property_type) = '');

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % active listings still have NULL property_type', remaining;
  END IF;
END $$;

COMMIT;
