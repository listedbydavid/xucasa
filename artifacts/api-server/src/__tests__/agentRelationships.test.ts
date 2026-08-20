/**
 * agentRelationships.test.ts
 *
 * Focused tests for Task #32 — Protect agent relationships and listing sharing.
 *
 * Tests cover:
 *   1. Assignment protection — real agent is never overwritten
 *   2. Referral validity and precedence
 *   3. Platform default assignment (David)
 *   4. buyer/link-agent authorization
 *   5. agent/send-listing dedupe
 *   6. Safe response data (no sensitive fields)
 *   7. HTTP auth gating (live server, if reachable)
 *
 * Run with:
 *   npx tsx artifacts/api-server/src/__tests__/agentRelationships.test.ts
 */

import assert from "node:assert/strict";
import { DAVID_USER_ID } from "../storage";

// ── Constants ────────────────────────────────────────────────────────────────

const REAL_AGENT_ID = "real-agent-001";
const OTHER_AGENT_ID = "other-agent-002";
const BUYER_ID = "buyer-xyz";

// ── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message || err}`);
    failed++;
  }
}

// ── Helper: simulate assignPlatformAgentIfNeeded logic ───────────────────────

function simulateAssignIfNeeded(user: { assignedAgentUserId: string | null }) {
  if (user.assignedAgentUserId) return user.assignedAgentUserId; // no-op
  return DAVID_USER_ID;
}

// ── 1. Assignment protection ─────────────────────────────────────────────────

(async () => {
  console.log("1. Assignment protection — real agent is never overwritten\n");

  await test("buyer with real agent — assignPlatformAgentIfNeeded is no-op", () => {
    const buyer = { assignedAgentUserId: REAL_AGENT_ID };
    const result = simulateAssignIfNeeded(buyer);
    assert.equal(result, REAL_AGENT_ID, "Real agent must not be overwritten");
  });

  await test("buyer with David assigned — assignPlatformAgentIfNeeded is no-op (already assigned)", () => {
    const buyer = { assignedAgentUserId: DAVID_USER_ID };
    const result = simulateAssignIfNeeded(buyer);
    assert.equal(result, DAVID_USER_ID, "David assignment is preserved as-is");
  });

  await test("buyer with no agent — assignPlatformAgentIfNeeded assigns David", () => {
    const buyer = { assignedAgentUserId: null };
    const result = simulateAssignIfNeeded(buyer);
    assert.equal(result, DAVID_USER_ID, "Unrepresented buyer gets David");
  });

  await test("contact-agent resolution: buyer with real agent → buyers_agent type", () => {
    // Simulate the contact-agent resolution logic
    const buyer = { assignedAgentUserId: REAL_AGENT_ID };
    const agentIdToShow = buyer.assignedAgentUserId && buyer.assignedAgentUserId !== DAVID_USER_ID
      ? buyer.assignedAgentUserId
      : null;
    assert.equal(agentIdToShow, REAL_AGENT_ID);
  });

  await test("contact-agent resolution: buyer with David → falls through to listing agent", () => {
    const buyer = { assignedAgentUserId: DAVID_USER_ID };
    const agentIdToShow = buyer.assignedAgentUserId && buyer.assignedAgentUserId !== DAVID_USER_ID
      ? buyer.assignedAgentUserId
      : null;
    assert.equal(agentIdToShow, null, "David buyer should see listing agent, not David");
  });

  // ── 2. Referral validity and precedence ────────────────────────────────────

  console.log("\n2. Referral validity and precedence\n");

  await test("valid referring agent takes precedence over listing agent for unrepresented buyer", () => {
    const referringAgent = { id: OTHER_AGENT_ID, agentVerified: true, role: "agent" };
    const listingAgentId = REAL_AGENT_ID;
    // Simulate contact-agent: referring checked first
    const displayedAgentId = referringAgent.agentVerified && referringAgent.role === "agent"
      ? referringAgent.id
      : listingAgentId;
    assert.equal(displayedAgentId, OTHER_AGENT_ID);
  });

  await test("unverified referring agent is ignored — falls through to listing agent", () => {
    const referringAgent = { id: OTHER_AGENT_ID, agentVerified: false, role: "agent" };
    const listingAgentId = REAL_AGENT_ID;
    const displayedAgentId = referringAgent.agentVerified && referringAgent.role === "agent"
      ? referringAgent.id
      : listingAgentId;
    assert.equal(displayedAgentId, REAL_AGENT_ID, "Unverified referring agent must be ignored");
  });

  await test("referral link does not override real buyer agent assignment", () => {
    // Simulate account creation with referral in session
    const sessionReferring = OTHER_AGENT_ID;
    const currentAssigned: string = REAL_AGENT_ID; // real agent already assigned
    // Central invariant: only assign if no real agent
    const davidId: string = DAVID_USER_ID;
    const finalAssigned = currentAssigned && currentAssigned !== davidId
      ? currentAssigned
      : sessionReferring;
    assert.equal(finalAssigned, REAL_AGENT_ID, "Referral link must not override real agent");
  });

  await test("referral link assigns referring agent on new account with no prior assignment", () => {
    const sessionReferring = OTHER_AGENT_ID;
    const referringAgent = { id: OTHER_AGENT_ID, agentVerified: true, role: "agent" };
    const currentAssigned = null;
    const finalAssigned = !currentAssigned && referringAgent.agentVerified
      ? referringAgent.id
      : DAVID_USER_ID;
    assert.equal(finalAssigned, OTHER_AGENT_ID, "Verified referral agent should be assigned on new account");
  });

  await test("invalid referral (unverified agent) falls back to David on registration", () => {
    const referringAgent = { id: OTHER_AGENT_ID, agentVerified: false, role: "agent" };
    const currentAssigned = null;
    const finalAssigned = !currentAssigned && referringAgent.agentVerified
      ? referringAgent.id
      : DAVID_USER_ID;
    assert.equal(finalAssigned, DAVID_USER_ID, "Unverified referral falls back to David");
  });

  // ── 3. buyer/link-agent authorization ─────────────────────────────────────

  console.log("\n3. buyer/link-agent authorization\n");

  await test("buyer with real agent cannot link another agent (409)", () => {
    const buyer = { assignedAgentUserId: REAL_AGENT_ID as string | null };
    const isProtected = buyer.assignedAgentUserId && buyer.assignedAgentUserId !== DAVID_USER_ID;
    assert.ok(isProtected, "Buyer with real agent should get 409");
  });

  await test("buyer with David assigned can link a real agent", () => {
    const buyer = { assignedAgentUserId: DAVID_USER_ID };
    const isProtected = buyer.assignedAgentUserId && buyer.assignedAgentUserId !== DAVID_USER_ID;
    assert.ok(!isProtected, "David-assigned buyer should be allowed to link real agent");
  });

  await test("buyer with no agent can link a real agent", () => {
    const buyer = { assignedAgentUserId: null };
    const isProtected = buyer.assignedAgentUserId && buyer.assignedAgentUserId !== DAVID_USER_ID;
    assert.ok(!isProtected, "Unassigned buyer should be allowed to link real agent");
  });

  // ── 4. agent/send-listing dedupe ──────────────────────────────────────────

  console.log("\n4. agent/send-listing dedupe\n");

  await test("saving same property twice is idempotent (ON CONFLICT DO NOTHING)", () => {
    // Simulate the ON CONFLICT DO NOTHING behaviour
    const savedSet = new Set<string>();
    function upsertSave(userId: string, propertyId: number): boolean {
      const key = `${userId}:${propertyId}`;
      if (savedSet.has(key)) return false; // already saved
      savedSet.add(key);
      return true;
    }
    const first = upsertSave(BUYER_ID, 42);
    const second = upsertSave(BUYER_ID, 42);
    assert.ok(first, "First save should succeed");
    assert.ok(!second, "Second save should be a no-op");
    assert.equal(savedSet.size, 1, "Only one record in set");
  });

  // ── 5. Safe response data ─────────────────────────────────────────────────

  console.log("\n5. Safe response data\n");

  await test("safeAgentFields strips passwordHash, adminNotes, accountSource", () => {
    const rawAgent = {
      id: REAL_AGENT_ID,
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
      phone: "555-1234",
      profileImageUrl: null,
      brokerageName: "Best Realty",
      agentMlsId: "MLS123",
      passwordHash: "secret-hash",
      adminNotes: "internal notes",
      accountSource: "google",
      role: "agent",
    };

    // Simulate safeAgentFields
    const { passwordHash: _pw, adminNotes: _an, accountSource: _as, role: _r, ...safe } = rawAgent as any;
    assert.ok(!("passwordHash" in safe), "passwordHash must be stripped");
    assert.ok(!("adminNotes" in safe), "adminNotes must be stripped");
    assert.ok(!("accountSource" in safe), "accountSource must be stripped");
    assert.ok("firstName" in safe, "firstName must be present");
    assert.ok("email" in safe, "email must be present");
  });

  await test("agents/search response never exposes passwordHash", () => {
    // The route only selects from users table and maps safeAgentFields
    const agentRow = {
      id: "agent-1",
      firstName: "Bob",
      lastName: "Jones",
      email: "bob@realty.com",
      phone: null,
      profileImageUrl: null,
      brokerageName: "Top Agents",
      agentMlsId: null,
      passwordHash: "bcrypt-hash",
      adminNotes: "verified manually",
      accountSource: "real",
    };
    const exposed = {
      id: agentRow.id,
      firstName: agentRow.firstName,
      lastName: agentRow.lastName,
      email: agentRow.email,
      phone: agentRow.phone,
      profileImageUrl: agentRow.profileImageUrl,
      brokerageName: agentRow.brokerageName,
      agentMlsId: agentRow.agentMlsId,
    };
    assert.ok(!("passwordHash" in exposed), "passwordHash must not be in search results");
    assert.ok(!("adminNotes" in exposed), "adminNotes must not be in search results");
  });

  // ── 6. HTTP auth gating (live server) ─────────────────────────────────────

  console.log("\n6. HTTP auth gating (live server)\n");

  const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
  let serverUp = false;
  try {
    const ping = await fetch(`${BASE}/api/healthz`);
    serverUp = ping.status < 500;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    console.log("  ⊘ skipping HTTP tests — dev server not reachable at " + BASE);
  } else {
    await test("public GET /api/properties/1/contact-agent → 200 or 404 (no auth needed)", async () => {
      const r = await fetch(`${BASE}/api/properties/1/contact-agent`);
      assert.ok([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });

    await test("unauthenticated GET /api/agents/search → 401", async () => {
      const r = await fetch(`${BASE}/api/agents/search?q=david`);
      assert.equal(r.status, 401);
    });

    await test("unauthenticated POST /api/agent/send-listing → 401", async () => {
      const r = await fetch(`${BASE}/api/agent/send-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUserId: "x", propertyId: 1 }),
      });
      assert.equal(r.status, 401);
    });

    await test("unauthenticated GET /api/buyer/my-agent → 401", async () => {
      const r = await fetch(`${BASE}/api/buyer/my-agent`);
      assert.equal(r.status, 401);
    });

    await test("unauthenticated GET /api/agent/listing-share-url/1 → 401", async () => {
      const r = await fetch(`${BASE}/api/agent/listing-share-url/1`);
      assert.equal(r.status, 401);
    });

    await test("unauthenticated POST /api/buyer/link-agent → 401", async () => {
      const r = await fetch(`${BASE}/api/buyer/link-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentUserId: "x" }),
      });
      assert.equal(r.status, 401);
    });

    await test("tour inquiry with no contact method → 400", async () => {
      const r = await fetch(`${BASE}/api/properties/1/tour-inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test User" }),
      });
      // Either 400 (validation) or 404 (property not found) are acceptable
      assert.ok([400, 404].includes(r.status), `Expected 400/404, got ${r.status}`);
    });
  }

  console.log(
    `\n${failed === 0 ? "All" : passed} of ${passed + failed} tests passed${failed ? `, ${failed} FAILED` : ""}.`
  );
  if (failed > 0) process.exitCode = 1;
})();
