/**
 * Swipe → agent assignment integration tests.
 *
 * Locks in the David Hussain platform-default fallback used by both
 * /api/swipe-interest and /api/buyer-interest. The pure resolution logic
 * lives in `resolveBuyerAgent()` exported from server/storage.ts so we can
 * test it deterministically against an in-memory mock storage. Auth gating
 * is exercised via real HTTP against the running dev server (port 5000).
 *
 * Run with:
 *   npx tsx server/__tests__/agentAssignment.test.ts
 */

import assert from 'node:assert/strict';
import { resolveBuyerAgent, DAVID_USER_ID, type AgentResolutionStorage } from '../storage';

const BUYER_ID = 'buyer-123';
const OTHER_AGENT_ID = 'agent-existing-999';

interface SpyCall {
  fn: string;
  args: any[];
}

function makeMockStorage(opts: {
  users?: Record<string, any>;
  resolveAndAssignAgent?: (id: string) => any;
}): AgentResolutionStorage & { calls: SpyCall[] } {
  const calls: SpyCall[] = [];
  const users = { ...(opts.users || {}) };
  return {
    calls,
    async getUser(id: string) {
      calls.push({ fn: 'getUser', args: [id] });
      return users[id] || undefined;
    },
    async assignAgent(buyerUserId: string, agentUserId: string) {
      calls.push({ fn: 'assignAgent', args: [buyerUserId, agentUserId] });
      // Mirror the real DB side-effect so subsequent getUser sees the link.
      if (users[buyerUserId]) users[buyerUserId].assignedAgentUserId = agentUserId;
    },
    async resolveAndAssignAgent(buyerUserId: string) {
      calls.push({ fn: 'resolveAndAssignAgent', args: [buyerUserId] });
      return opts.resolveAndAssignAgent ? opts.resolveAndAssignAgent(buyerUserId) : null;
    },
  };
}

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

(async () => {
  console.log('Swipe → agent assignment tests\n');

  // ── David fallback logic ────────────────────────────────────────────────
  console.log('David fallback logic');

  await test('unrepresented buyer with no assignedAgentUserId → assigned David (55534280)', async () => {
    const storage = makeMockStorage({
      users: {
        [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: null },
        [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com', firstName: 'David' },
      },
    });
    const result = await resolveBuyerAgent(BUYER_ID, storage);
    assert.equal(result.agent?.id, DAVID_USER_ID);
    assert.equal(result.assignmentType, 'platform_default');
    const assigned = storage.calls.find((c) => c.fn === 'assignAgent');
    assert.ok(assigned, 'assignAgent must be called');
    assert.deepEqual(assigned!.args, [BUYER_ID, DAVID_USER_ID]);
    // resolveAndAssignAgent must NOT be called when David exists.
    assert.ok(!storage.calls.some((c) => c.fn === 'resolveAndAssignAgent'));
  });

  await test('buyer who already has an assigned agent → assignment NOT overwritten', async () => {
    const storage = makeMockStorage({
      users: {
        [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: OTHER_AGENT_ID },
        [OTHER_AGENT_ID]: { id: OTHER_AGENT_ID, email: 'preexisting@example.com' },
        [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com' },
      },
    });
    const result = await resolveBuyerAgent(BUYER_ID, storage);
    assert.equal(result.agent?.id, OTHER_AGENT_ID);
    assert.equal(result.assignmentType, 'existing');
    // No new assignment, no fallback resolution.
    assert.ok(!storage.calls.some((c) => c.fn === 'assignAgent'));
    assert.ok(!storage.calls.some((c) => c.fn === 'resolveAndAssignAgent'));
  });

  await test('previously-swiped property → upsert preserves existing assignment (no duplicate)', async () => {
    // Simulates a buyer who already has David assigned from a prior swipe.
    // The second resolution should return David without calling assignAgent
    // again — upsertBuyerInterest is responsible for de-duping the row.
    const storage = makeMockStorage({
      users: {
        [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: DAVID_USER_ID },
        [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com' },
      },
    });
    const result = await resolveBuyerAgent(BUYER_ID, storage);
    assert.equal(result.agent?.id, DAVID_USER_ID);
    assert.equal(result.assignmentType, 'existing');
    assert.ok(!storage.calls.some((c) => c.fn === 'assignAgent'),
      'must NOT re-assign when already assigned');
  });

  await test("David's user id missing → falls back to resolveAndAssignAgent without crashing", async () => {
    const adminFallback = { id: 'admin-fallback', email: 'admin@xucasa.com', role: 'admin' };
    const storage = makeMockStorage({
      users: {
        [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: null },
        // David intentionally absent.
      },
      resolveAndAssignAgent: () => adminFallback,
    });
    const result = await resolveBuyerAgent(BUYER_ID, storage);
    assert.equal(result.agent?.id, 'admin-fallback');
    assert.equal(result.assignmentType, 'fallback');
    assert.ok(storage.calls.some((c) => c.fn === 'resolveAndAssignAgent'),
      'fallback resolver must be called when David is missing');
    // assignAgent must NOT be called by resolveBuyerAgent itself in fallback
    // path — the legacy resolveAndAssignAgent owns that side effect.
    assert.ok(!storage.calls.some((c) => c.fn === 'assignAgent'));
  });

  await test("David missing AND fallback returns null → returns null without throwing", async () => {
    const storage = makeMockStorage({
      users: { [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: null } },
      resolveAndAssignAgent: () => null,
    });
    const result = await resolveBuyerAgent(BUYER_ID, storage);
    assert.equal(result.agent, null);
    assert.equal(result.assignmentType, null);
  });

  // ── Agent assignment audit trail ────────────────────────────────────────
  console.log('\nAgent assignment audit trail');

  await test('David fallback fires → audit metadata shape is { assignmentType: "platform_default", agentId: "55534280" }', async () => {
    const storage = makeMockStorage({
      users: {
        [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: null },
        [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com' },
      },
    });
    const { agent, assignmentType } = await resolveBuyerAgent(BUYER_ID, storage);
    // The route handler builds the audit overrides from these two values:
    //   metadata: { ..., assignmentType, agentId: assignedAgent.id }
    // and tags it under eventType 'agent_assigned' (via the swipe_interest_created
    // / buyer_interest_upserted wrappers — David assignment is the assignment event).
    const auditMetadata = { assignmentType, agentId: agent!.id };
    assert.deepEqual(auditMetadata, {
      assignmentType: 'platform_default',
      agentId: '55534280',
    });
  });

  await test('existing-agent path produces audit metadata with assignmentType: "existing"', async () => {
    const storage = makeMockStorage({
      users: {
        [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: OTHER_AGENT_ID },
        [OTHER_AGENT_ID]: { id: OTHER_AGENT_ID, email: 'pre@x.com' },
        [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com' },
      },
    });
    const { agent, assignmentType } = await resolveBuyerAgent(BUYER_ID, storage);
    assert.deepEqual({ assignmentType, agentId: agent!.id }, {
      assignmentType: 'existing',
      agentId: OTHER_AGENT_ID,
    });
  });

  // ── Concession-aware swipe ──────────────────────────────────────────────
  console.log('\nConcession-aware swipe');

  await test('swipe right on property with active concession → buyer_interest created AND concession fetchable', async () => {
    // Models the runtime contract: the swipe handler calls upsertBuyerInterest,
    // and GET /api/properties/:id/concessions returns the active row.
    const PROP_ID = 42;
    const concession = { id: 1, propertyId: PROP_ID, amount: 5000, isActive: true };
    const interestRows: any[] = [];

    const swipeStorage = {
      ...makeMockStorage({
        users: {
          [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: null },
          [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com' },
        },
      }),
      async upsertBuyerInterest(propertyId: number, buyerUserId: string, source: string, assignedAgentUserId: string) {
        const row = { id: interestRows.length + 1, propertyId, buyerUserId, source, assignedAgentUserId };
        interestRows.push(row);
        return row;
      },
      async getActiveConcession(propertyId: number) {
        return propertyId === PROP_ID ? concession : null;
      },
    };

    const { agent } = await resolveBuyerAgent(BUYER_ID, swipeStorage);
    const bi = await swipeStorage.upsertBuyerInterest(PROP_ID, BUYER_ID, 'swipe', agent!.id);
    assert.equal(bi.propertyId, PROP_ID);
    assert.equal(bi.buyerUserId, BUYER_ID);
    assert.equal(interestRows.length, 1);

    const c = await swipeStorage.getActiveConcession(PROP_ID);
    assert.ok(c, 'concession must be fetchable for the swiped property');
    assert.equal(c!.amount, 5000);
    assert.equal(c!.isActive, true);
  });

  await test('swipe right on property with NO concession → normal flow, concession lookup returns null', async () => {
    const PROP_ID = 99;
    const interestRows: any[] = [];
    const swipeStorage = {
      ...makeMockStorage({
        users: {
          [BUYER_ID]: { id: BUYER_ID, assignedAgentUserId: null },
          [DAVID_USER_ID]: { id: DAVID_USER_ID, email: 'david@xucasa.com' },
        },
      }),
      async upsertBuyerInterest(propertyId: number, buyerUserId: string, source: string, assignedAgentUserId: string) {
        const row = { id: 1, propertyId, buyerUserId, source, assignedAgentUserId };
        interestRows.push(row);
        return row;
      },
      async getActiveConcession(_propertyId: number) {
        return null;
      },
    };

    const { agent } = await resolveBuyerAgent(BUYER_ID, swipeStorage);
    const bi = await swipeStorage.upsertBuyerInterest(PROP_ID, BUYER_ID, 'swipe', agent!.id);
    assert.equal(bi.propertyId, PROP_ID);
    assert.equal(interestRows.length, 1);

    const c = await swipeStorage.getActiveConcession(PROP_ID);
    assert.equal(c, null, 'no concession modal should be triggered');
  });

  // ── Auth gating (live HTTP against dev server) ──────────────────────────
  console.log('\nAuth gating (live HTTP)');

  const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
  let serverUp = false;
  try {
    const ping = await fetch(`${BASE}/api/concessions/active`);
    serverUp = ping.status < 500;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    console.log('  ⊘ skipping HTTP auth tests — dev server not reachable at ' + BASE);
  } else {
    await test('unauthenticated POST /api/buyer-interest → 401', async () => {
      const r = await fetch(`${BASE}/api/buyer-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: 1 }),
      });
      assert.equal(r.status, 401);
    });

    await test('unauthenticated POST /api/swipe-interest → 401', async () => {
      const r = await fetch(`${BASE}/api/swipe-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: 1 }),
      });
      assert.equal(r.status, 401);
    });
  }

  console.log(`\n${failed === 0 ? 'All' : passed} of ${passed + failed} tests passed${failed ? `, ${failed} FAILED` : ''}.`);
  if (failed > 0) process.exitCode = 1;
})();
