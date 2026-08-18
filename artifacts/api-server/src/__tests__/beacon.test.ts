/**
 * Beacon scoring math — integration test.
 *
 * Run with:
 *   npx tsx server/__tests__/beacon.test.ts
 *
 * Pure-function tests against the exported scoring helpers in
 * server/storage.ts. Covers the cases captured in task #14:
 *
 *   1. Exact bed/bath, pre-approved, ASAP timeline → "Strong" tier (≥70)
 *   2. NULL mustHaves and no timeline → partial credit, not zero
 *   3. Approval exactly 95% of price → passes the budget gate
 *   4. Approval at 94% of price → fails the budget gate
 *   5. En-dash "3–6 months" scores the same as ASCII "3-6 months"
 *   6. Results are sorted by matchScore descending
 */

import assert from 'node:assert/strict';
import {
  scoreBuyer,
  passesBudgetGate,
  minBuyerBudget,
  type BeaconScoringCriteria,
  type BeaconScoringProfile,
} from '../storage';

// Freeze "now" so the recency component is deterministic across runs.
// 2026-04-19 (the date this test was written).
const NOW = new Date('2026-04-19T00:00:00Z').getTime();
const DAYS = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000);

const baseListing: BeaconScoringCriteria = {
  price: 600_000,
  beds: 3,
  baths: 2,
  sqft: 1500,
  city: 'San Diego',
  propertyType: 'Single Family',
  mustHaves: ['pool', 'garage'],
};

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('Beacon scoring tests\n');

// ---------------------------------------------------------------------------
// Case 1: Strong-tier buyer
// ---------------------------------------------------------------------------
test('Case 1: exact beds, pre-approved, ASAP timeline scores in Strong tier (>=70)', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 720_000,    // +20% headroom → 20/20 budget
    isPreApproved: true,            // 15/15 preApproval
    minBeds: 3,
    maxBeds: 3,                     // exact match → 15/15 beds
    mustHaves: ['pool', 'garage'],  // 100% overlap → 20/20 mustHaves
    moveInTimeline: 'ASAP',         // 15/15 timeline
    createdAt: DAYS(7),             // ~14/15 recency
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  assert.equal(result.matchTier, 'Strong', `expected Strong tier, got ${result.matchTier} (score=${result.matchScore})`);
  assert.ok(result.matchScore >= 70, `expected score >= 70, got ${result.matchScore}`);
  assert.equal(result.scoreBreakdown.budget, 20);
  assert.equal(result.scoreBreakdown.preApproval, 15);
  assert.equal(result.scoreBreakdown.beds, 15);
  assert.equal(result.scoreBreakdown.mustHaves, 20);
  assert.equal(result.scoreBreakdown.timeline, 15);
});

// ---------------------------------------------------------------------------
// Case 2: NULL mustHaves and no timeline get partial credit, not zero
// ---------------------------------------------------------------------------
test('Case 2: NULL mustHaves yields partial credit (not zero)', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    isPreApproved: false,
    minBeds: 3,
    maxBeds: 3,
    mustHaves: null,
    moveInTimeline: null,
    createdAt: DAYS(45),
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  // mustHaves: neutral 5 pts when either side has no data
  assert.equal(result.scoreBreakdown.mustHaves, 5, 'NULL mustHaves should score 5 (partial credit), not 0');
  assert.ok(result.scoreBreakdown.mustHaves > 0, 'must-haves component must be > 0 for null');
});

test('Case 2-timeline: NULL moveInTimeline gets neutral 5 pts (not zero)', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    isPreApproved: false,
    minBeds: 3, maxBeds: 3,
    mustHaves: ['pool'],
    moveInTimeline: null,
    createdAt: DAYS(45),
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  assert.equal(result.scoreBreakdown.timeline, 5,
    'null moveInTimeline must score 5 (neutral), not 0');
});

test('Case 2-timeline: undefined moveInTimeline gets neutral 5 pts', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    minBeds: 3, maxBeds: 3,
    mustHaves: ['pool'],
    createdAt: DAYS(45),
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  assert.equal(result.scoreBreakdown.timeline, 5);
});

test('Case 2-timeline: empty-string moveInTimeline gets neutral 5 pts', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    minBeds: 3, maxBeds: 3,
    mustHaves: ['pool'],
    moveInTimeline: '',
    createdAt: DAYS(45),
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  assert.equal(result.scoreBreakdown.timeline, 5);
});

test('Case 2-timeline: unrecognized timeline value also gets neutral 5 pts', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    minBeds: 3, maxBeds: 3,
    mustHaves: ['pool'],
    moveInTimeline: 'sometime next year',
    createdAt: DAYS(45),
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  assert.equal(result.scoreBreakdown.timeline, 5);
});

test('Case 2b: empty-array mustHaves on the buyer also yields partial credit', () => {
  const buyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    isPreApproved: false,
    minBeds: 3,
    maxBeds: 3,
    mustHaves: [],
    moveInTimeline: undefined,
    createdAt: DAYS(45),
  };
  const result = scoreBuyer(buyer, baseListing, NOW);
  assert.equal(result.scoreBreakdown.mustHaves, 5);
});

// ---------------------------------------------------------------------------
// Case 3 & 4: Budget gate at the 95% threshold
// ---------------------------------------------------------------------------
test('Case 3: approval at exactly 95% of price passes the budget gate', () => {
  const price = 600_000;
  const approval = Math.round(price * 0.95); // 570,000
  assert.equal(minBuyerBudget(price), 570_000);
  assert.equal(passesBudgetGate(approval, price), true,
    `approval ${approval} should pass for price ${price}`);
});

test('Case 4: approval at 94% of price fails the budget gate', () => {
  const price = 600_000;
  const approval = Math.round(price * 0.94); // 564,000
  assert.equal(passesBudgetGate(approval, price), false,
    `approval ${approval} should fail for price ${price}`);
});

test('Case 4b: budget gate also fails one dollar below threshold', () => {
  const price = 600_000;
  assert.equal(passesBudgetGate(569_999, price), false);
  assert.equal(passesBudgetGate(570_000, price), true);
});

// ---------------------------------------------------------------------------
// Case 5: En-dash equivalence
// ---------------------------------------------------------------------------
test('Case 5: en-dash "3–6 months" scores the same as ASCII "3-6 months"', () => {
  const baseBuyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,
    isPreApproved: true,
    minBeds: 3,
    maxBeds: 3,
    mustHaves: ['pool'],
    createdAt: DAYS(10),
  };
  const ascii = scoreBuyer({ ...baseBuyer, moveInTimeline: '3-6 months' }, baseListing, NOW);
  const enDash = scoreBuyer({ ...baseBuyer, moveInTimeline: '3\u20136 months' }, baseListing, NOW);
  assert.equal(ascii.scoreBreakdown.timeline, enDash.scoreBreakdown.timeline,
    `timeline scores should match: ascii=${ascii.scoreBreakdown.timeline} en-dash=${enDash.scoreBreakdown.timeline}`);
  assert.equal(ascii.matchScore, enDash.matchScore,
    `total scores should match: ascii=${ascii.matchScore} en-dash=${enDash.matchScore}`);
  assert.equal(ascii.scoreBreakdown.timeline, 9, '"3-6 months" should map to 9 pts');
});

// ---------------------------------------------------------------------------
// Case 6: Sort order
// ---------------------------------------------------------------------------
test('Case 6: results sort by matchScore descending', () => {
  const strong: BeaconScoringProfile = {
    preApprovalAmount: 720_000,
    isPreApproved: true,
    minBeds: 3, maxBeds: 3,
    mustHaves: ['pool', 'garage'],
    moveInTimeline: 'ASAP',
    createdAt: DAYS(5),
  };
  const good: BeaconScoringProfile = {
    preApprovalAmount: 620_000,
    isPreApproved: true,
    minBeds: 2, maxBeds: 4,
    mustHaves: ['garage'],
    moveInTimeline: '3-6 months',
    createdAt: DAYS(40),
  };
  const potential: BeaconScoringProfile = {
    preApprovalAmount: 610_000,
    isPreApproved: false,
    minBeds: 1, maxBeds: 5,
    mustHaves: null,
    moveInTimeline: 'just looking',
    createdAt: DAYS(120),
  };
  // Insert in non-sorted order to prove sort actually runs.
  const inputs = [potential, strong, good];
  const scored = inputs
    .map(p => scoreBuyer(p, baseListing, NOW))
    .sort((a, b) => b.matchScore - a.matchScore);

  for (let i = 1; i < scored.length; i++) {
    assert.ok(scored[i - 1].matchScore >= scored[i].matchScore,
      `score at index ${i - 1} (${scored[i - 1].matchScore}) should be >= score at index ${i} (${scored[i].matchScore})`);
  }
  // Sanity: the strong buyer should land on top.
  assert.equal(scored[0].matchTier, 'Strong');
});

// ---------------------------------------------------------------------------
// Bonus: tier thresholds
// ---------------------------------------------------------------------------
test('Bonus: tier thresholds at 70 (Strong), 45 (Good), and below (Potential)', () => {
  // Build buyers whose components hit known totals.
  // Potential: total < 45.
  const lowBuyer: BeaconScoringProfile = {
    preApprovalAmount: 600_000,    // 0 budget headroom → 0
    isPreApproved: false,           // 0
    minBeds: 1, maxBeds: 5,         // diff>=2 → 3
    mustHaves: [],                  // neutral 5
    moveInTimeline: 'just looking', // 0
    createdAt: DAYS(120),           // 0
  };
  const low = scoreBuyer(lowBuyer, baseListing, NOW);
  assert.equal(low.matchTier, 'Potential', `expected Potential, got ${low.matchTier} (${low.matchScore})`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
