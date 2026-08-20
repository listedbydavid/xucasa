/**
 * IDX Transition — unit tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the auto-archiving logic that detects when an agent-owned manual
 * listing (off_market / coming_soon / pre_market) appears in the live IDX feed.
 *
 * Pure-function tests — no real DB connection required.
 *
 * Run with:
 *   npx tsx src/__tests__/idxTransition.test.ts
 */

import assert from "node:assert/strict";
import { normaliseAddress } from "../idxSync";

// ── Test runner helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  };
  pendingTests.push(run());
}

const pendingTests: Promise<void>[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// Part 1: normaliseAddress — pure function tests (no DB)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\nnormaliseAddress — all-five-components required\n");

test("all five components present → returns non-empty canonical key", () => {
  const key = normaliseAddress({
    streetNumber: "123",
    streetName: "Main St",
    city: "San Diego",
    state: "CA",
    zip: "92101",
  });
  assert.notEqual(key, "", "expected a non-empty key when all components are present");
  assert.ok(key.includes("street"), `expected 'street' abbreviation expansion, got: ${key}`);
  assert.ok(key.includes("123"), `expected street number in key, got: ${key}`);
  assert.ok(key.includes("san diego"), `expected city in key, got: ${key}`);
  assert.ok(key.includes("92101"), `expected zip in key, got: ${key}`);
});

test("missing streetNumber → returns empty string (partial address blocked)", () => {
  const key = normaliseAddress({
    streetNumber: null,
    streetName: "Main Street",
    city: "San Diego",
    state: "CA",
    zip: "92101",
  });
  assert.equal(key, "", "missing streetNumber must produce empty string");
});

test("missing streetName → returns empty string", () => {
  const key = normaliseAddress({
    streetNumber: "100",
    streetName: null,
    city: "San Diego",
    state: "CA",
    zip: "92101",
  });
  assert.equal(key, "", "missing streetName must produce empty string");
});

test("missing city → returns empty string", () => {
  const key = normaliseAddress({
    streetNumber: "100",
    streetName: "Oak Street",
    city: null,
    state: "CA",
    zip: "92101",
  });
  assert.equal(key, "", "missing city must produce empty string");
});

test("missing state → returns empty string", () => {
  const key = normaliseAddress({
    streetNumber: "100",
    streetName: "Oak Street",
    city: "San Diego",
    state: null,
    zip: "92101",
  });
  assert.equal(key, "", "missing state must produce empty string");
});

test("missing zip → returns empty string", () => {
  const key = normaliseAddress({
    streetNumber: "100",
    streetName: "Oak Street",
    city: "San Diego",
    state: "CA",
    zip: null,
  });
  assert.equal(key, "", "missing zip must produce empty string");
});

test("zip with only 4 digits → returns empty string (not a valid 5-digit zip)", () => {
  const key = normaliseAddress({
    streetNumber: "100",
    streetName: "Oak Street",
    city: "San Diego",
    state: "CA",
    zip: "9210",
  });
  assert.equal(key, "", "4-digit zip must produce empty string");
});

test("all-null parts → returns empty string (no crash)", () => {
  const key = normaliseAddress({ streetNumber: null, streetName: null, city: null, state: null, zip: null });
  assert.equal(key, "", "all-null must produce empty string");
});

console.log("\nnormaliseAddress — abbreviation expansion\n");

test("St → street: two addresses differing only in abbreviation normalise identically", () => {
  const a = normaliseAddress({ streetNumber: "456", streetName: "Oak St", city: "La Mesa", state: "CA", zip: "91941" });
  const b = normaliseAddress({ streetNumber: "456", streetName: "Oak Street", city: "La Mesa", state: "CA", zip: "91941" });
  assert.notEqual(a, "", "expected non-empty key");
  assert.equal(a, b, `expected equal keys:\n  a=${a}\n  b=${b}`);
});

test("Ave → avenue", () => {
  const a = normaliseAddress({ streetNumber: "7", streetName: "Park Ave", city: "Chula Vista", state: "CA", zip: "91910" });
  const b = normaliseAddress({ streetNumber: "7", streetName: "Park Avenue", city: "Chula Vista", state: "CA", zip: "91910" });
  assert.notEqual(a, "", "expected non-empty key");
  assert.equal(a, b);
});

test("Blvd → boulevard", () => {
  const a = normaliseAddress({ streetNumber: "1000", streetName: "Harbor Blvd", city: "San Diego", state: "CA", zip: "92154" });
  const b = normaliseAddress({ streetNumber: "1000", streetName: "Harbor Boulevard", city: "San Diego", state: "CA", zip: "92154" });
  assert.notEqual(a, "", "expected non-empty key");
  assert.equal(a, b);
});

test("Rd → road", () => {
  const a = normaliseAddress({ streetNumber: "50", streetName: "Mira Mesa Rd", city: "San Diego", state: "CA", zip: "92126" });
  const b = normaliseAddress({ streetNumber: "50", streetName: "Mira Mesa Road", city: "San Diego", state: "CA", zip: "92126" });
  assert.notEqual(a, "", "expected non-empty key");
  assert.equal(a, b);
});

console.log("\nnormaliseAddress — non-match invariants\n");

test("different street numbers do NOT produce the same key", () => {
  const a = normaliseAddress({ streetNumber: "100", streetName: "Elm Street", city: "Santee", state: "CA", zip: "92071" });
  const b = normaliseAddress({ streetNumber: "101", streetName: "Elm Street", city: "Santee", state: "CA", zip: "92071" });
  assert.notEqual(a, "", "both keys must be non-empty");
  assert.notEqual(a, b, "different street numbers must not produce the same key");
});

test("different cities do NOT produce the same key", () => {
  const a = normaliseAddress({ streetNumber: "10", streetName: "Pine Road", city: "El Cajon", state: "CA", zip: "92020" });
  const b = normaliseAddress({ streetNumber: "10", streetName: "Pine Road", city: "La Mesa", state: "CA", zip: "92041" });
  assert.notEqual(a, "", "both keys must be non-empty");
  assert.notEqual(a, b, "different cities must not produce the same key");
});

test("different zip codes do NOT produce the same key", () => {
  const a = normaliseAddress({ streetNumber: "10", streetName: "Harbor Boulevard", city: "San Diego", state: "CA", zip: "92101" });
  const b = normaliseAddress({ streetNumber: "10", streetName: "Harbor Boulevard", city: "San Diego", state: "CA", zip: "92102" });
  assert.notEqual(a, "", "both keys must be non-empty");
  assert.notEqual(a, b, "different zips must not produce the same key");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Part 2: Matching logic — mirror of archiveManualListingsMatchedByMls (no DB)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The matching logic inside archiveManualListingsMatchedByMls is the same
 * algorithm mirrored here so we can test it without a live DB.  Any change
 * to the production logic must be reflected here.
 */

interface IdxRow {
  id: number;
  mlsNumber: string | null;
  addressStreetNumber: string | null;
  addressStreetName: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
}

interface ManualCandidate {
  id: number;
  agentId: string | null;
  expectedMlsNumber: string | null;
  listingStatus: string;
  addressStreetNumber: string | null;
  addressStreetName: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
}

const ARCHIVABLE_STATUSES = new Set(["off_market", "coming_soon", "pre_market"]);

/** Mirror of the matching logic inside archiveManualListingsMatchedByMls. */
function findMatch(
  candidate: ManualCandidate,
  mlsNumberMap: Map<string, number>,
  addressMap: Map<string, number>,
): { idxPropertyId: number; matchedBy: string } | null {
  if (!ARCHIVABLE_STATUSES.has((candidate.listingStatus || "").toLowerCase())) return null;

  // Priority 1: exact MLS number (case-insensitive)
  if (candidate.expectedMlsNumber) {
    const key = candidate.expectedMlsNumber.toLowerCase().trim();
    const found = mlsNumberMap.get(key);
    if (found !== undefined) return { idxPropertyId: found, matchedBy: "mls_number" };
  }

  // Priority 2: normalised full address (all five components required)
  const normAddr = normaliseAddress({
    streetNumber: candidate.addressStreetNumber,
    streetName: candidate.addressStreetName,
    city: candidate.addressCity,
    state: candidate.addressState,
    zip: candidate.addressZip,
  });
  if (normAddr) {
    const found = addressMap.get(normAddr);
    if (found !== undefined) return { idxPropertyId: found, matchedBy: "address" };
  }

  return null;
}

function buildMaps(rows: IdxRow[]): { mlsNumberMap: Map<string, number>; addressMap: Map<string, number> } {
  const mlsNumberMap = new Map<string, number>();
  const addressMap = new Map<string, number>();
  for (const row of rows) {
    if (row.mlsNumber) mlsNumberMap.set(row.mlsNumber.toLowerCase().trim(), row.id);
    const normAddr = normaliseAddress({
      streetNumber: row.addressStreetNumber,
      streetName: row.addressStreetName,
      city: row.addressCity,
      state: row.addressState,
      zip: row.addressZip,
    });
    // Only add to the address map when all five parts are present (normAddr !== "")
    if (normAddr) addressMap.set(normAddr, row.id);
  }
  return { mlsNumberMap, addressMap };
}

// ─── MLS-number matching ───────────────────────────────────────────────────────

console.log("\nMLS-number matching tests\n");

test("exact MLS number match (same case) → matched by mls_number", () => {
  const idxRows: IdxRow[] = [
    { id: 99, mlsNumber: "SD2024001", addressStreetNumber: "5", addressStreetName: "Oak Ave", addressCity: "San Diego", addressState: "CA", addressZip: "92101" },
  ];
  const candidate: ManualCandidate = {
    id: 1, agentId: "agent1", expectedMlsNumber: "SD2024001", listingStatus: "coming_soon",
    addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null,
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.ok(match !== null, "expected a match");
  assert.equal(match!.idxPropertyId, 99);
  assert.equal(match!.matchedBy, "mls_number");
});

test("exact MLS number match (case-insensitive) → matched", () => {
  const idxRows: IdxRow[] = [
    { id: 200, mlsNumber: "abc123", addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null },
  ];
  const candidate: ManualCandidate = {
    id: 2, agentId: "agent2", expectedMlsNumber: "ABC123", listingStatus: "off_market",
    addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null,
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.ok(match !== null, "expected a case-insensitive MLS number match");
  assert.equal(match!.idxPropertyId, 200);
  assert.equal(match!.matchedBy, "mls_number");
});

test("MLS number mismatch → no match", () => {
  const idxRows: IdxRow[] = [
    { id: 300, mlsNumber: "XYZ999", addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null },
  ];
  const candidate: ManualCandidate = {
    id: 3, agentId: "agent3", expectedMlsNumber: "XYZ000", listingStatus: "pre_market",
    addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null,
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "mismatched MLS numbers must not produce a match");
});

test("no expectedMlsNumber and all address parts present → falls through to address match", () => {
  const idxRows: IdxRow[] = [
    { id: 400, mlsNumber: "MLSXXX", addressStreetNumber: "100", addressStreetName: "Maple Ave", addressCity: "El Cajon", addressState: "CA", addressZip: "92020" },
  ];
  const candidate: ManualCandidate = {
    id: 4, agentId: "agent4", expectedMlsNumber: null, listingStatus: "coming_soon",
    addressStreetNumber: "100", addressStreetName: "Maple Avenue", addressCity: "El Cajon", addressState: "CA", addressZip: "92020",
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.ok(match !== null, "expected an address-based match");
  assert.equal(match!.idxPropertyId, 400);
  assert.equal(match!.matchedBy, "address");
});

// ─── Normalised-address matching ───────────────────────────────────────────────

console.log("\nNormalised-address matching tests\n");

test("St vs Street: abbreviated manual listing matches full IDX street name", () => {
  const idxRows: IdxRow[] = [
    { id: 500, mlsNumber: null, addressStreetNumber: "789", addressStreetName: "Pine Street", addressCity: "Santee", addressState: "CA", addressZip: "92071" },
  ];
  const candidate: ManualCandidate = {
    id: 5, agentId: "agent5", expectedMlsNumber: null, listingStatus: "off_market",
    addressStreetNumber: "789", addressStreetName: "Pine St", addressCity: "Santee", addressState: "CA", addressZip: "92071",
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.ok(match !== null, "abbreviated street must match expanded form");
  assert.equal(match!.idxPropertyId, 500);
  assert.equal(match!.matchedBy, "address");
});

test("different zip codes → no address match", () => {
  const idxRows: IdxRow[] = [
    { id: 600, mlsNumber: null, addressStreetNumber: "10", addressStreetName: "Harbor Blvd", addressCity: "San Diego", addressState: "CA", addressZip: "92101" },
  ];
  const candidate: ManualCandidate = {
    id: 6, agentId: "agent6", expectedMlsNumber: null, listingStatus: "pre_market",
    addressStreetNumber: "10", addressStreetName: "Harbor Boulevard", addressCity: "San Diego", addressState: "CA", addressZip: "92102",
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "different zip codes must not match");
});

test("IDX row with partial address (missing zip) is not in address map → no address match", () => {
  // The IDX row has no zip so normaliseAddress returns "" and it's not indexed.
  // The manual candidate has a full address but no match is possible.
  const idxRows: IdxRow[] = [
    { id: 601, mlsNumber: null, addressStreetNumber: "20", addressStreetName: "Elm Street", addressCity: "Lemon Grove", addressState: "CA", addressZip: null },
  ];
  const candidate: ManualCandidate = {
    id: 61, agentId: "agent61", expectedMlsNumber: null, listingStatus: "coming_soon",
    addressStreetNumber: "20", addressStreetName: "Elm Street", addressCity: "Lemon Grove", addressState: "CA", addressZip: "91945",
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  // Address map must be empty (partial IDX address not indexed)
  assert.equal(addressMap.size, 0, "partial IDX address must not enter the address map");
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "partial IDX address must never match");
});

test("manual candidate with partial address (missing city) → no address match even if IDX row is complete", () => {
  const idxRows: IdxRow[] = [
    { id: 602, mlsNumber: null, addressStreetNumber: "30", addressStreetName: "Cedar Lane", addressCity: "Coronado", addressState: "CA", addressZip: "92118" },
  ];
  const candidate: ManualCandidate = {
    id: 62, agentId: "agent62", expectedMlsNumber: null, listingStatus: "off_market",
    addressStreetNumber: "30", addressStreetName: "Cedar Lane", addressCity: null, addressState: "CA", addressZip: "92118",
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  assert.ok(addressMap.size > 0, "IDX row with full address must be in address map");
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "manual candidate with missing city must not match");
});

// ─── Non-match: ineligible listing status ─────────────────────────────────────

console.log("\nNon-match — ineligible listingStatus tests\n");

test("listingStatus='active' is NOT archivable → no match even with exact MLS number", () => {
  const idxRows: IdxRow[] = [
    { id: 700, mlsNumber: "ACTIVE001", addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null },
  ];
  const candidate: ManualCandidate = {
    id: 7, agentId: "agent7", expectedMlsNumber: "ACTIVE001", listingStatus: "active",
    addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null,
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "active listings must never be auto-archived");
});

test("listingStatus='archived' is NOT archivable → no match", () => {
  const idxRows: IdxRow[] = [
    { id: 800, mlsNumber: "ARCH001", addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null },
  ];
  const candidate: ManualCandidate = {
    id: 8, agentId: "agent8", expectedMlsNumber: "ARCH001", listingStatus: "archived",
    addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null,
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "already-archived listings must not be re-matched");
});

test("listingStatus='pending' is NOT archivable → no match", () => {
  const idxRows: IdxRow[] = [
    { id: 900, mlsNumber: "PEND001", addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null },
  ];
  const candidate: ManualCandidate = {
    id: 9, agentId: "agent9", expectedMlsNumber: "PEND001", listingStatus: "pending",
    addressStreetNumber: null, addressStreetName: null, addressCity: null, addressState: null, addressZip: null,
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "pending listings must not be auto-archived");
});

// ─── Priority: MLS number wins over address ───────────────────────────────────

console.log("\nMLS-number vs address priority tests\n");

test("MLS number takes priority over address when each points to a different IDX row", () => {
  const idxRows: IdxRow[] = [
    { id: 1001, mlsNumber: "MLS-A", addressStreetNumber: "1", addressStreetName: "Alpha Street", addressCity: "San Diego", addressState: "CA", addressZip: "92101" },
    { id: 1002, mlsNumber: "MLS-B", addressStreetNumber: "2", addressStreetName: "Beta Road",   addressCity: "San Diego", addressState: "CA", addressZip: "92103" },
  ];
  // expectedMlsNumber → row 1001; address → row 1002
  const candidate: ManualCandidate = {
    id: 10, agentId: "agent10", expectedMlsNumber: "MLS-A", listingStatus: "coming_soon",
    addressStreetNumber: "2", addressStreetName: "Beta Road", addressCity: "San Diego", addressState: "CA", addressZip: "92103",
  };
  const { mlsNumberMap, addressMap } = buildMaps(idxRows);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.ok(match !== null, "expected a match");
  assert.equal(match!.idxPropertyId, 1001, "MLS number must win over address match");
  assert.equal(match!.matchedBy, "mls_number");
});

test("empty IDX rows array → no match possible", () => {
  const candidate: ManualCandidate = {
    id: 11, agentId: "agent11", expectedMlsNumber: "NOMLS", listingStatus: "off_market",
    addressStreetNumber: "5", addressStreetName: "Elm Lane", addressCity: "San Diego", addressState: "CA", addressZip: "92101",
  };
  const { mlsNumberMap, addressMap } = buildMaps([]);
  const match = findMatch(candidate, mlsNumberMap, addressMap);
  assert.equal(match, null, "no IDX rows → no match possible");
});

// ── Final summary ──────────────────────────────────────────────────────────────

Promise.all(pendingTests).then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
});
