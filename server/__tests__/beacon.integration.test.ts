import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";

import { db, pool } from "../db";
import { storage } from "../storage";
import { users, buyerProfiles, properties } from "@shared/schema";

const TEST_AGENT_ID = "beacon-test-agent-001";
const TEST_BUYER_USER_IDS = [
  "beacon-test-buyer-strong",
  "beacon-test-buyer-good",
  "beacon-test-buyer-potential",
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
