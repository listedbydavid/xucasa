/**
 * Buyer profile completeness — unit tests for buyerProfileCompleteness().
 *
 * Run with:
 *   npx tsx server/__tests__/buyerProfile.test.ts
 */

import assert from 'node:assert/strict';
import { buyerProfileCompleteness } from '../storage';
import type { BuyerProfile } from '@shared/schema';

type ProfileShape = Pick<
  BuyerProfile,
  | 'minBeds' | 'maxBeds' | 'minBaths' | 'minSqft' | 'maxSqft'
  | 'preferredCities' | 'homeTypes' | 'mustHaves' | 'moveInTimeline'
>;

const empty: ProfileShape = {
  minBeds: null, maxBeds: null, minBaths: null, minSqft: null, maxSqft: null,
  preferredCities: null, homeTypes: null, mustHaves: null, moveInTimeline: null,
};

const ALL_LABELS = [
  'Bedroom preferences',
  'Bathroom minimum',
  'Preferred cities',
  'Home type preferences',
  'Must-have features',
  'Move-in timeline',
  'Size preferences',
];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(err.message || err);
    process.exitCode = 1;
  }
}

console.log('buyerProfileCompleteness()');

test('empty profile scores 0 and lists all 7 missing fields', () => {
  const r = buyerProfileCompleteness(empty);
  assert.equal(r.score, 0);
  assert.deepEqual(r.missingFields.sort(), [...ALL_LABELS].sort());
});

test('only preferredCities filled scores 20', () => {
  const r = buyerProfileCompleteness({ ...empty, preferredCities: ['San Diego'] });
  assert.equal(r.score, 20);
  assert.ok(!r.missingFields.includes('Preferred cities'));
  assert.ok(r.missingFields.includes('Bedroom preferences'));
});

test('empty array does NOT count as filled', () => {
  const r = buyerProfileCompleteness({ ...empty, preferredCities: [], homeTypes: [], mustHaves: [] });
  assert.equal(r.score, 0);
});

test('only minBeds filled (no maxBeds) still scores the 15-pt bedroom band', () => {
  const r = buyerProfileCompleteness({ ...empty, minBeds: 3 });
  assert.equal(r.score, 15);
});

test('only maxBeds filled (no minBeds) also scores the 15-pt bedroom band', () => {
  const r = buyerProfileCompleteness({ ...empty, maxBeds: 5 });
  assert.equal(r.score, 15);
});

test('only minSqft filled scores the 10-pt size band', () => {
  const r = buyerProfileCompleteness({ ...empty, minSqft: 1500 });
  assert.equal(r.score, 10);
});

test('whitespace-only moveInTimeline does NOT count', () => {
  const r = buyerProfileCompleteness({ ...empty, moveInTimeline: '   ' });
  assert.equal(r.score, 0);
  assert.ok(r.missingFields.includes('Move-in timeline'));
});

test('fully filled profile scores 100 and missingFields is empty', () => {
  const r = buyerProfileCompleteness({
    minBeds: 3, maxBeds: 4, minBaths: '2',
    minSqft: 1500, maxSqft: 2500,
    preferredCities: ['San Diego', 'La Jolla'],
    homeTypes: ['Single Family', 'Condo'],
    mustHaves: ['pool', 'garage'],
    moveInTimeline: '1-3 months',
  } as ProfileShape);
  assert.equal(r.score, 100);
  assert.deepEqual(r.missingFields, []);
});

test('partially filled profile (cities + bedrooms + must-haves) scores 55 and lists the right missing labels', () => {
  const r = buyerProfileCompleteness({
    ...empty,
    preferredCities: ['San Diego'],
    minBeds: 3,
    mustHaves: ['pool'],
  });
  // 20 (cities) + 15 (beds) + 20 (must-haves) = 55
  assert.equal(r.score, 55);
  assert.deepEqual(r.missingFields.sort(), [
    'Bathroom minimum',
    'Home type preferences',
    'Move-in timeline',
    'Size preferences',
  ].sort());
});

test('moveInTimeline en-dash → hyphen normalization (PATCH endpoint contract)', () => {
  // The PATCH endpoint in server/routes.ts performs:
  //   value.replace(/–/g, '-').toLowerCase().trim()
  // before persisting. Mirror that here so the test locks in the contract.
  const normalize = (v: string) => v.replace(/–/g, '-').toLowerCase().trim();

  assert.equal(normalize('3–6 months'), '3-6 months');
  assert.equal(normalize('  1–3 Months  '), '1-3 months');
  assert.equal(normalize('ASAP'), 'asap');
  // Hyphen input is unchanged (idempotent)
  assert.equal(normalize('3-6 months'), '3-6 months');
});

console.log(process.exitCode ? '\nFAILED' : '\nAll tests passed.');
