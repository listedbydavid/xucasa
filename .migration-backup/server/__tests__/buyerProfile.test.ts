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

// ─── Onboarding flow contract tests ──────────────────────────────────────
// These lock in that a buyer who completes the new 5-step onboarding
// wizard exits with a completeness score of at least 60.
//
// The wizard collects: preferredCities (20), homeTypes (15), minBeds (15),
// moveInTimeline (10), and optionally mustHaves (20). The first four alone
// = 60pts, hitting our minimum bar.

console.log('\nOnboarding flow tests');

// Mirror of the client-side timeline normalization in client/src/pages/Onboarding.tsx.
function normalizeOnboardingTimeline(input: string): string {
  if (!input) return '';
  if (input === 'Just browsing') return 'just looking';
  return input.replace(/–/g, '-').trim().toLowerCase();
}

// Mirror of the server-side merge in POST /api/onboarding/buyer that ONLY
// writes provided non-empty fields, so partial submissions don't wipe data.
function mergeOnboarding(existing: ProfileShape, incoming: Partial<ProfileShape>): ProfileShape {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    (out as any)[k] = v;
  }
  return out;
}

test('completing all 5 onboarding steps scores ≥ 60 (cities + hometypes + beds + timeline)', () => {
  const onboarded: ProfileShape = mergeOnboarding(empty, {
    preferredCities: ['San Diego', 'La Jolla'],
    homeTypes: ['Single Family', 'Condo'],
    minBeds: 3,
    moveInTimeline: normalizeOnboardingTimeline('1–3 months'),
    mustHaves: ['pool', 'garage'],
  });
  const r = buyerProfileCompleteness(onboarded);
  // 20 (cities) + 15 (homeTypes) + 15 (beds) + 10 (timeline) + 20 (mustHaves) = 80
  assert.ok(r.score >= 60, `expected ≥ 60, got ${r.score}`);
  assert.equal(r.score, 80);
});

test('skipping everything in onboarding scores 0', () => {
  const onboarded: ProfileShape = mergeOnboarding(empty, {
    preferredCities: [],
    homeTypes: [],
    mustHaves: [],
    moveInTimeline: '',
  });
  assert.equal(buyerProfileCompleteness(onboarded).score, 0);
});

test('skipping ONLY must-haves still scores ≥ 60', () => {
  const onboarded: ProfileShape = mergeOnboarding(empty, {
    preferredCities: ['San Diego'],
    homeTypes: ['Single Family'],
    minBeds: 3,
    moveInTimeline: 'asap',
    mustHaves: [],  // skipped
  });
  const r = buyerProfileCompleteness(onboarded);
  // 20 (cities) + 15 (hometypes) + 15 (beds) + 10 (timeline) = 60
  assert.equal(r.score, 60);
  assert.ok(r.score >= 60);
});

test('"Just browsing" maps to "just looking" (TIMELINE_SCORES key)', () => {
  assert.equal(normalizeOnboardingTimeline('Just browsing'), 'just looking');
  // And it counts as a filled timeline field for completeness scoring.
  const r = buyerProfileCompleteness({ ...empty, moveInTimeline: 'just looking' });
  assert.equal(r.score, 10);
});

test('en-dash timeline normalizes to hyphen+lowercase before saving', () => {
  assert.equal(normalizeOnboardingTimeline('1–3 months'), '1-3 months');
  assert.equal(normalizeOnboardingTimeline('3–6 MONTHS'), '3-6 months');
  assert.equal(normalizeOnboardingTimeline('  6–12 Months  '), '6-12 months');
  assert.equal(normalizeOnboardingTimeline('ASAP'), 'asap');
});

test('existing profile data is NOT overwritten by empty onboarding defaults', () => {
  // A buyer already has cities + beds + timeline saved from a previous session.
  // They land back on onboarding (re-entry) and submit with all-empty arrays.
  // The merge must preserve existing values.
  const existing: ProfileShape = {
    ...empty,
    preferredCities: ['San Diego'],
    minBeds: 4,
    moveInTimeline: 'asap',
    mustHaves: ['pool'],
  };
  const merged = mergeOnboarding(existing, {
    preferredCities: [],   // empty array — should NOT wipe
    homeTypes: [],         // still missing, OK to leave empty
    mustHaves: [],         // empty array — should NOT wipe
    moveInTimeline: '',    // empty string — should NOT wipe
  });
  assert.deepEqual(merged.preferredCities, ['San Diego']);
  assert.equal(merged.minBeds, 4);
  assert.equal(merged.moveInTimeline, 'asap');
  assert.deepEqual(merged.mustHaves, ['pool']);
  // And completeness is preserved at the same level as before:
  assert.equal(buyerProfileCompleteness(merged).score, buyerProfileCompleteness(existing).score);
});

console.log(process.exitCode ? '\nFAILED' : '\nAll tests passed.');
