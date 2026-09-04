import assert from "node:assert/strict";
import {
  groupAgentProperties,
  isVerifiedAgent,
  propertyAttributedToAgent,
  publicAgentProfile,
  resolveAgentPublicProfile,
} from "../routes/agentPublicProfiles";
import { normaliseReso } from "../idxSync";

let passed = 0;
let failed = 0;
const pending: Promise<void>[] = [];
function test(name: string, fn: () => void) {
  pending.push(Promise.resolve().then(fn).then(() => { passed++; console.log(`✓ ${name}`); }).catch((error) => {
    failed++; console.error(`✗ ${name}: ${error.message}`);
  }));
}

const agent = { id: "agent-1", role: "agent", agentVerified: true, firstName: "Account", lastName: "Agent", email: "account@example.com", phone: "111", profileImageUrl: "https://account/image", brokerageName: "Account Brokerage", mailingAddress: "Account address", licenseNumber: "DRE-account", licenseState: "CA", agentMlsId: "MLS-1" };
const profile = { mlsDisplayName: "MLS Agent", mlsEmail: "mls@example.com", mlsPhone: "222", mlsWebsite: "https://mls.example.com", mlsProfileImageUrl: "https://mls/image", mlsBrokerageName: "MLS Brokerage", mlsBrokerageAddress: "MLS address", mlsBrokerageWebsite: "https://broker.example.com", mlsLicense: "DRE-MLS", mlsBrokerageLicense: "BROKER-MLS" };

test("verified-agent predicate requires both agent role and verification", () => {
  assert.equal(isVerifiedAgent(agent), true);
  assert.equal(isVerifiedAgent({ ...agent, agentVerified: false }), false);
  assert.equal(isVerifiedAgent({ ...agent, role: "buyer" }), false);
  assert.equal(isVerifiedAgent(null), false);
});

test("MLS, account, override precedence and null reset are distinct", () => {
  const mls = resolveAgentPublicProfile(agent, profile);
  assert.equal(mls.displayName.value, "MLS Agent");
  assert.equal(mls.displayName.source, "mls");
  const overridden = resolveAgentPublicProfile(agent, { ...profile, displayNameOverride: "Corrected", licenseOverride: "DRE-override", brokerageLicenseOverride: "BROKER-override" });
  assert.equal(overridden.displayName.value, "Corrected");
  assert.equal(overridden.displayName.source, "override");
  assert.equal(overridden.license.value, "DRE-override");
  assert.equal(overridden.brokerageLicense.value, "BROKER-override");
  const reset = resolveAgentPublicProfile(agent, { ...profile, displayNameOverride: null, licenseOverride: null, brokerageLicenseOverride: null });
  assert.equal(reset.displayName.value, "MLS Agent");
  assert.equal(reset.license.value, "DRE-MLS");
  assert.equal(reset.brokerageLicense.value, "BROKER-MLS");
  assert.equal(resolveAgentPublicProfile(agent, {}).email.source, "account");
});

test("every contact, brokerage, and license visibility flag masks public output", () => {
  const hidden = publicAgentProfile(agent, { ...profile, showEmail: false, showPhone: false, showWebsite: false, showLicense: false, showBrokerageName: false, showBrokerageAddress: false, showBrokerageWebsite: false, showBrokerageLicense: false });
  assert.equal(hidden.email, null); assert.equal(hidden.phone, null); assert.equal(hidden.website, null);
  assert.equal(hidden.licenseNumber, null); assert.equal(hidden.brokerageName, null); assert.equal(hidden.brokerageAddress, null);
  assert.equal(hidden.brokerageWebsite, null); assert.equal(hidden.brokerageLicense, null);
  assert.equal(hidden.licenseState, null);
});

test("attribution uses only listing-side authoritative identifiers", () => {
  assert.equal(propertyAttributedToAgent({ agentId: "agent-1" }, agent), true);
  assert.equal(propertyAttributedToAgent({ listingAgentMlsId: "MLS-1" }, agent), true);
  assert.equal(propertyAttributedToAgent({ listingAgentLicenseNumber: "DRE-account" }, agent), true);
  assert.equal(propertyAttributedToAgent({ assignedAgentUserId: "agent-1" }, agent), false);
  assert.equal(propertyAttributedToAgent({ buyerAgentId: "agent-1", clientAgentLinkId: "agent-1", buyerInterest: { assignedAgentUserId: "agent-1" } }, agent), false);
});

test("RESO imports persist MemberKey for profile attribution", () => {
  const imported = normaliseReso({
    ListingKey: "listing-1",
    ListingId: "MLS-123",
    ListAgentKey: "MLS-1",
    ListAgentMlsId: "secondary-agent-id",
    ListPrice: 500000,
    StandardStatus: "Closed",
    StreetNumber: "1",
    StreetName: "Main St",
    City: "San Diego",
    StateOrProvince: "CA",
  });
  assert.equal(imported.listingAgentMlsId, "MLS-1");
  assert.equal(propertyAttributedToAgent(imported, agent), true);
});

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const property = (id: number, extra: any = {}) => ({ id, agentId: "agent-1", status: "active", listingStatus: "active", archivedAt: null, isOffMarket: false, listDate: d("2025-01-01"), createdAt: d("2025-01-01"), ...extra });

test("private/archive lifecycle is excluded from either status column", () => {
  const rows = [
    property(1), property(2, { status: "archived" }), property(3, { listingStatus: "private" }),
    property(4, { status: "active", listingStatus: "off_market" }), property(5, { archivedAt: d("2025-01-01") }),
  ];
  assert.deepEqual(groupAgentProperties(rows, agent, d("2025-06-01")).currentListings.map(p => p.id), [1]);
});

test("current listings sort newest list date first", () => {
  const rows = [property(1, { listDate: d("2025-02-01") }), property(2, { listDate: d("2025-05-01") }), property(3, { listDate: d("2025-03-01") })];
  assert.deepEqual(groupAgentProperties(rows, agent, d("2025-06-01")).currentListings.map(p => p.id), [2, 3, 1]);
});

test("sales respect YTD, previous-year, five-calendar-year and legacy date boundaries", () => {
  const rows = [
    property(1, { status: "sold", listingStatus: "sold", closeDate: d("2025-01-01") }),
    property(2, { status: "sold", listingStatus: "sold", closeDate: d("2024-12-31") }),
    property(3, { status: "sold", listingStatus: "sold", closeDate: d("2021-01-01") }),
    property(4, { status: "sold", listingStatus: "sold", closeDate: d("2020-12-31") }),
    property(5, { status: "sold", listingStatus: "sold", closeDate: null, listDate: d("2025-04-01") }),
  ];
  const grouped = groupAgentProperties(rows, agent, d("2025-06-01"));
  assert.deepEqual(grouped.salesYtd.map(p => p.id), [5, 1]);
  assert.deepEqual(grouped.salesPreviousYear.map(p => p.id), [2]);
  assert.deepEqual(grouped.salesFiveYears.map(p => p.id), [5, 1, 2, 3]);
  assert.deepEqual(grouped.periods, { currentYear: 2025, previousYear: 2024, fiveYearStart: 2021 });
});

Promise.all(pending).then(() => {
  console.log(`\n${passed} passed, ${failed} failed (36 assertions)\n`);
  if (failed) process.exit(1);
});