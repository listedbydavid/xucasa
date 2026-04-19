import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";

import { db, pool } from "../db";
import { storage } from "../storage";
import { users, buyerProfiles, properties, type InsertBuyerProfile } from "@shared/schema";

const TEST_AGENT_ID = "beacon-test-agent-001";
const TEST_BUYER_USER_IDS = [
  "beacon-test-buyer-strong",
  "beacon-test-buyer-good",
  "beacon-test-buyer-potential",
  "beacon-test-buyer-inactive",
  "beacon-test-buyer-underbudget",
  "beacon-test-buyer-minbeds-too-high",
  "beacon-test-buyer-maxbeds-too-low",
  "beacon-test-buyer-minbaths-too-high",
  "beacon-test-buyer-minsqft-too-high",
  "beacon-test-buyer-maxsqft-too-low",
  "beacon-test-buyer-wrong-city",
  "beacon-test-buyer-wrong-type",
];

const LISTING = {
  price: 500_000,
  beds: 3,
  baths: 2,
  sqft: 1_800,
  city: "Austin",
  propertyType: "SFH",
  mustHaves: ["garage", "pool"],
};

let strongProfileId: number;
let goodProfileId: number;
let potentialProfileId: number;
let testPropertyId: number;

// Buyers that should be filtered OUT by exactly one hard gate.
const excludedProfileIds: Record<string, number> = {};

async function cleanup() {
  await db.execute(sql`
    DELETE FROM ${buyerProfiles}
    WHERE ${buyerProfiles.userId} IN (${sql.join(
      TEST_BUYER_USER_IDS.map((id) => sql`${id}`),
      sql`, `,
    )})
  `);
  await db.execute(sql`
    DELETE FROM ${properties} WHERE ${properties.agentId} = ${TEST_AGENT_ID}
  `);
  await db.execute(sql`
    DELETE FROM ${users}
    WHERE ${users.id} IN (${sql.join(
      [TEST_AGENT_ID, ...TEST_BUYER_USER_IDS].map((id) => sql`${id}`),
      sql`, `,
    )})
  `);
}

before(async () => {
  await cleanup();

  await db.insert(users).values([
    {
      id: TEST_AGENT_ID,
      email: `${TEST_AGENT_ID}@test.local`,
      role: "agent",
      agentVerified: true,
      accountSource: "test",
    },
    ...TEST_BUYER_USER_IDS.map((id) => ({
      id,
      email: `${id}@test.local`,
      role: "user",
      accountSource: "test",
    })),
  ]);

  const [property] = await db
    .insert(properties)
    .values({
      title: "Beacon Test Listing",
      description: "Fixture listing used by beacon scoring tests.",
      price: LISTING.price,
      location: `${LISTING.city}, TX`,
      addressCity: LISTING.city,
      addressState: "TX",
      beds: LISTING.beds,
      baths: String(LISTING.baths),
      sqft: LISTING.sqft,
      propertyType: LISTING.propertyType,
      agentId: TEST_AGENT_ID,
      source: "manual",
    })
    .returning();
  testPropertyId = property.id;

  const [strong] = await db
    .insert(buyerProfiles)
    .values({
      userId: TEST_BUYER_USER_IDS[0],
      displayName: "Strong Buyer",
      preApprovalAmount: 625_000, // 25% headroom -> 20 pts (capped)
      isPreApproved: true,         // 15 pts
      minBeds: 3,
      maxBeds: 3,                  // exact match -> 15 pts
      minBaths: "2",
      minSqft: 1_500,
      maxSqft: 2_500,
      preferredCities: [LISTING.city],
      homeTypes: [LISTING.propertyType],
      mustHaves: ["garage", "pool"], // overlap 2/2 -> 20 pts
      moveInTimeline: "asap",        // 15 pts
      isActive: true,
    })
    .returning();
  strongProfileId = strong.id;

  const [good] = await db
    .insert(buyerProfiles)
    .values({
      userId: TEST_BUYER_USER_IDS[1],
      displayName: "Good Buyer",
      preApprovalAmount: 525_000, // 5% headroom -> 5 pts
      isPreApproved: true,         // 15 pts
      minBeds: 2,
      maxBeds: 4,                  // within range, diff=1 -> 8 pts
      minBaths: "2",
      minSqft: 1_500,
      maxSqft: 2_500,
      preferredCities: [LISTING.city],
      homeTypes: [LISTING.propertyType],
      mustHaves: ["garage", "pool", "yard"], // overlap 2/3 -> 13 pts
      moveInTimeline: "3-6 months",          // 9 pts
      isActive: true,
    })
    .returning();
  goodProfileId = good.id;

  const [potential] = await db
    .insert(buyerProfiles)
    .values({
      userId: TEST_BUYER_USER_IDS[2],
      displayName: "Potential Buyer",
      preApprovalAmount: 500_000, // 0% headroom -> 0 pts (still passes >=475k filter)
      isPreApproved: false,        // 0 pts
      minBeds: 2,
      maxBeds: 5,                  // within range, diff=1 -> 8 pts
      minBaths: "2",
      minSqft: 1_500,
      maxSqft: 2_500,
      preferredCities: [LISTING.city],
      homeTypes: [LISTING.propertyType],
      mustHaves: ["yard", "fireplace"], // overlap 0/2 -> 0 pts
      moveInTimeline: "12+ months",     // 1 pt
      isActive: true,
    })
    .returning();
  potentialProfileId = potential.id;

  // ---------------------------------------------------------------------
  // Buyers that SHOULD be excluded by the hard filters in
  // matchBuyersForListing. Each buyer is otherwise fully qualified and
  // fails exactly one gate so the exclusion can't be attributed to any
  // other condition.
  // ---------------------------------------------------------------------
  const baseQualified: Omit<InsertBuyerProfile, "userId" | "displayName"> = {
    preApprovalAmount: 600_000,           // well above 95% of 500k
    isPreApproved: true,
    minBeds: 3,
    maxBeds: 3,
    minBaths: "2",
    minSqft: 1_500,
    maxSqft: 2_500,
    preferredCities: [LISTING.city],
    homeTypes: [LISTING.propertyType],
    mustHaves: ["garage", "pool"],
    moveInTimeline: "asap",
    isActive: true,
  };

  type ExcludedSeed = {
    key: string;
    userId: string;
    overrides: Partial<InsertBuyerProfile> & { displayName: string };
  };

  const excludedSeeds: ExcludedSeed[] = [
    {
      key: "inactive",
      userId: "beacon-test-buyer-inactive",
      overrides: { displayName: "Inactive Buyer", isActive: false },
    },
    {
      key: "underbudget",
      // 94% of 500k = 470k, below the 95% (475k) gate
      userId: "beacon-test-buyer-underbudget",
      overrides: { displayName: "Under-budget Buyer", preApprovalAmount: 470_000 },
    },
    {
      key: "minbeds-too-high",
      userId: "beacon-test-buyer-minbeds-too-high",
      overrides: { displayName: "MinBeds Too High", minBeds: 4, maxBeds: 5 },
    },
    {
      key: "maxbeds-too-low",
      userId: "beacon-test-buyer-maxbeds-too-low",
      overrides: { displayName: "MaxBeds Too Low", minBeds: 1, maxBeds: 2 },
    },
    {
      key: "minbaths-too-high",
      userId: "beacon-test-buyer-minbaths-too-high",
      overrides: { displayName: "MinBaths Too High", minBaths: "3" },
    },
    {
      key: "minsqft-too-high",
      userId: "beacon-test-buyer-minsqft-too-high",
      overrides: { displayName: "MinSqft Too High", minSqft: 2_000, maxSqft: 4_000 },
    },
    {
      key: "maxsqft-too-low",
      userId: "beacon-test-buyer-maxsqft-too-low",
      overrides: { displayName: "MaxSqft Too Low", minSqft: 800, maxSqft: 1_500 },
    },
    {
      key: "wrong-city",
      userId: "beacon-test-buyer-wrong-city",
      overrides: { displayName: "Wrong City Buyer", preferredCities: ["Dallas"] },
    },
    {
      key: "wrong-type",
      userId: "beacon-test-buyer-wrong-type",
      overrides: { displayName: "Wrong Type Buyer", homeTypes: ["Condo"] },
    },
  ];

  for (const seed of excludedSeeds) {
    const [row] = await db
      .insert(buyerProfiles)
      .values({ ...baseQualified, userId: seed.userId, ...seed.overrides })
      .returning();
    excludedProfileIds[seed.key] = row.id;
  }
});

after(async () => {
  await cleanup();
  // Close the shared pg pool so the node:test runner can exit. If/when more
  // *.test.ts files are added that share `db`, move this teardown to a single
  // global hook (e.g. a test setup file) to avoid double-close errors.
  await pool.end();
});

test("matchBuyersForListing returns the seeded buyers with locked-in scores", async () => {
  const matches = await storage.matchBuyersForListing(LISTING);

  const byId = new Map(matches.map((m) => [m.id, m]));
  const strong = byId.get(strongProfileId);
  const good = byId.get(goodProfileId);
  const potential = byId.get(potentialProfileId);

  assert.ok(strong, "Strong buyer fixture should match the listing");
  assert.ok(good, "Good buyer fixture should match the listing");
  assert.ok(potential, "Potential buyer fixture should match the listing");

  // Strong buyer: 20 + 15 + 15 + 20 + 15 + 15 = 100
  assert.deepEqual(strong!.scoreBreakdown, {
    budget: 20,
    preApproval: 15,
    beds: 15,
    mustHaves: 20,
    timeline: 15,
    recency: 15,
  });
  assert.equal(strong!.matchScore, 100);
  assert.equal(strong!.matchTier, "Strong");

  // Good buyer: 5 + 15 + 8 + 13 + 9 + 15 = 65
  assert.deepEqual(good!.scoreBreakdown, {
    budget: 5,
    preApproval: 15,
    beds: 8,
    mustHaves: 13,
    timeline: 9,
    recency: 15,
  });
  assert.equal(good!.matchScore, 65);
  assert.equal(good!.matchTier, "Good");

  // Potential buyer: 0 + 0 + 8 + 0 + 1 + 15 = 24
  assert.deepEqual(potential!.scoreBreakdown, {
    budget: 0,
    preApproval: 0,
    beds: 8,
    mustHaves: 0,
    timeline: 1,
    recency: 15,
  });
  assert.equal(potential!.matchScore, 24);
  assert.equal(potential!.matchTier, "Potential");
});

test("matchBuyersForListing sorts results by matchScore descending", async () => {
  const matches = await storage.matchBuyersForListing(LISTING);
  const seeded = matches.filter((m) =>
    [strongProfileId, goodProfileId, potentialProfileId].includes(m.id),
  );

  assert.deepEqual(
    seeded.map((m) => m.id),
    [strongProfileId, goodProfileId, potentialProfileId],
    "Seeded buyers should appear in Strong > Good > Potential order",
  );

  for (let i = 1; i < matches.length; i++) {
    assert.ok(
      matches[i - 1].matchScore >= matches[i].matchScore,
      `Results not sorted descending at index ${i}: ${matches[i - 1].matchScore} < ${matches[i].matchScore}`,
    );
  }
});

test("tier thresholds are enforced at the documented cutoffs (>=70 Strong, >=45 Good)", async () => {
  const matches = await storage.matchBuyersForListing(LISTING);
  for (const m of matches) {
    if (m.matchScore >= 70) assert.equal(m.matchTier, "Strong");
    else if (m.matchScore >= 45) assert.equal(m.matchTier, "Good");
    else assert.equal(m.matchTier, "Potential");
  }
});

// ---------------------------------------------------------------------------
// Hard filter exclusions — each seeded buyer is otherwise fully qualified
// for the listing but fails exactly one gate. None of them should appear
// in the results from matchBuyersForListing.
// ---------------------------------------------------------------------------
test("hard filters exclude buyers that fail any single gate", async () => {
  const matches = await storage.matchBuyersForListing(LISTING);
  const matchedIds = new Set(matches.map((m) => m.id));

  // Sanity: the qualified fixtures still match (guards against accidentally
  // breaking the existing scoring tests with our new seed data).
  assert.ok(matchedIds.has(strongProfileId), "Strong fixture should still match");
  assert.ok(matchedIds.has(goodProfileId), "Good fixture should still match");
  assert.ok(matchedIds.has(potentialProfileId), "Potential fixture should still match");

  const cases: Array<[string, string]> = [
    ["inactive", "isActive=false buyers must be filtered out"],
    ["underbudget", "buyers under 95% of list price must be filtered out"],
    ["minbeds-too-high", "buyers whose minBeds > listing beds must be filtered out"],
    ["maxbeds-too-low", "buyers whose maxBeds < listing beds must be filtered out"],
    ["minbaths-too-high", "buyers whose minBaths > listing baths must be filtered out"],
    ["minsqft-too-high", "buyers whose minSqft > listing sqft must be filtered out"],
    ["maxsqft-too-low", "buyers whose maxSqft < listing sqft must be filtered out"],
    ["wrong-city", "buyers whose preferredCities don't include the listing city must be filtered out"],
    ["wrong-type", "buyers whose homeTypes don't include the listing propertyType must be filtered out"],
  ];

  for (const [key, message] of cases) {
    const id = excludedProfileIds[key];
    assert.ok(id, `missing seeded buyer for case "${key}"`);
    assert.ok(!matchedIds.has(id), message);
  }
});

test("budget gate rejects 94% of price but accepts exactly 95%", async () => {
  // Boundary check at the listing level: matchBuyersForListing uses
  // minBuyerBudget(price) = Math.round(price * 0.95). For 500_000 that's 475_000.
  const just_below_id = excludedProfileIds["underbudget"]; // 470_000 → reject
  let matches = await storage.matchBuyersForListing(LISTING);
  let matchedIds = new Set(matches.map((m) => m.id));
  assert.ok(!matchedIds.has(just_below_id), "470k must NOT pass for a 500k listing");

  // Bump that same buyer's pre-approval to exactly the threshold and
  // confirm it now passes the budget gate. We mutate then restore so the
  // change is invisible to other tests.
  await db.update(buyerProfiles)
    .set({ preApprovalAmount: 475_000 })
    .where(sql`id = ${just_below_id}`);
  try {
    matches = await storage.matchBuyersForListing(LISTING);
    matchedIds = new Set(matches.map((m) => m.id));
    assert.ok(matchedIds.has(just_below_id), "475k (exactly 95%) MUST pass for a 500k listing");
  } finally {
    await db.update(buyerProfiles)
      .set({ preApprovalAmount: 470_000 })
      .where(sql`id = ${just_below_id}`);
  }
});

test("city filter is case-insensitive", async () => {
  // The wrong-city buyer prefers "Dallas" so should not match an Austin
  // listing. Flip them to "AUSTIN" (uppercase) and confirm the LOWER()
  // comparison still lets them through.
  const id = excludedProfileIds["wrong-city"];
  await db.update(buyerProfiles)
    .set({ preferredCities: ["AUSTIN"] })
    .where(sql`id = ${id}`);
  try {
    const matches = await storage.matchBuyersForListing(LISTING);
    const matchedIds = new Set(matches.map((m) => m.id));
    assert.ok(matchedIds.has(id), "city filter should be case-insensitive");
  } finally {
    await db.update(buyerProfiles)
      .set({ preferredCities: ["Dallas"] })
      .where(sql`id = ${id}`);
  }
});
