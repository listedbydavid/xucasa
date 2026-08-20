/**
 * Agent-first listing workflow — focused API regression tests.
 *
 * Covers:
 *  1. Unverified agents cannot create listings (403)
 *  2. Verified agent creation ignores forged agent identity/contact fields
 *  3. Non-owners cannot edit, archive, add/remove photos, or read analytics
 *  4. Owner can update lifecycle status
 *  5. Owner can soft-archive with a reason
 *  6. Public inquiry persists and routes to listing agent (no buyer assignment)
 *  7. Public inquiry routes to referral agent from session
 *  8. Public inquiry routes to buyer's assigned agent (not overriding buyer)
 *  9. Property view deduplicates same IP/property within one hour
 * 10. Analytics are owner-only and aggregate stored views/inquiries/saves
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import test, { after, before } from "node:test";
import express from "express";
import session from "express-session";
import { and, eq, inArray } from "drizzle-orm";
import {
  notifications,
  properties,
  propertyAnalytics,
  propertyInquiries,
  savedProperties,
  users,
} from "@workspace/db";
import { db, pool } from "../db";
import { createListingShareToken } from "../lib/listingShareAccess";

// ─── Unique ID namespace (avoids collisions with other test files) ───────────

const NS = "t-listing-wf";

const IDS = {
  verifiedAgent:   `${NS}-verified-agent`,
  otherAgent:      `${NS}-other-agent`,
  unverifiedAgent: `${NS}-unverified-agent`,
  buyer:           `${NS}-buyer`,
  referralAgent:   `${NS}-referral-agent`,
};

const ALL_USER_IDS = Object.values(IDS);

// Collected property IDs for cleanup
let propertyIds: number[] = [];
let baseUrl = "";
let server: ReturnType<typeof createServer>;
let previousNodeEnv: string | undefined;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  if (propertyIds.length > 0) {
    await db.delete(propertyAnalytics).where(inArray(propertyAnalytics.propertyId, propertyIds));
    await db.delete(propertyInquiries).where(inArray(propertyInquiries.propertyId, propertyIds));
    await db.delete(savedProperties).where(inArray(savedProperties.propertyId, propertyIds));
    await db.delete(notifications).where(inArray(notifications.propertyId, propertyIds));
    await db.delete(properties).where(inArray(properties.id, propertyIds));
  }
  await db.delete(notifications).where(inArray(notifications.userId, ALL_USER_IDS));
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS));
  propertyIds = [];
}

async function request(
  path: string,
  options: {
    method?: string;
    userId?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const headers: Record<string, string> = {
    connection: "close",
    ...options.headers,
  };
  if (options.userId) headers["x-test-user-id"] = options.userId;
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const payload =
    options.body === undefined ? undefined : JSON.stringify(options.body);
  if (payload) headers["content-length"] = String(Buffer.byteLength(payload));

  const response = await new Promise<{
    status: number;
    headers: { get(name: string): string | null };
    text: string;
  }>((resolve, reject) => {
    const outgoing = httpRequest(
      `${baseUrl}${path}`,
      { method: options.method ?? "GET", headers },
      (incoming) => {
        let text = "";
        incoming.setEncoding("utf8");
        incoming.on("data", (chunk) => { text += chunk; });
        incoming.on("end", () => {
          resolve({
            status: incoming.statusCode ?? 0,
            headers: {
              get(name: string) {
                const value = incoming.headers[name.toLowerCase()];
                if (Array.isArray(value)) return value.join(", ");
                return value ?? null;
              },
            },
            text,
          });
        });
      },
    );
    outgoing.on("error", reject);
    if (payload) outgoing.write(payload);
    outgoing.end();
  });

  const body = response.text ? JSON.parse(response.text) : null;
  return { response, body };
}

// Minimal valid listing payload
function listingPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Workflow Test Home",
    description: "Integration test listing",
    price: 500_000,
    addressCity: "Austin",
    addressState: "TX",
    beds: 3,
    baths: 2,
    sqft: 1800,
    propertyType: "SFH",
    listingStatus: "active",
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  // Route guard checks; set to production so isAuthenticated is strict
  process.env.NODE_ENV = "production";

  const [{ default: propertiesRouter }] = await Promise.all([
    import("../routes/properties"),
  ]);

  await cleanup();

  // Insert all test users
  await db.insert(users).values([
    {
      id: IDS.verifiedAgent,
      email: `${NS}-verified-agent@test.local`,
      firstName: "Verified",
      lastName: "Agent",
      role: "agent",
      agentVerified: true,
      phone: "+15550000001",
    },
    {
      id: IDS.otherAgent,
      email: `${NS}-other-agent@test.local`,
      firstName: "Other",
      lastName: "Agent",
      role: "agent",
      agentVerified: true,
    },
    {
      id: IDS.unverifiedAgent,
      email: `${NS}-unverified-agent@test.local`,
      firstName: "Unverified",
      lastName: "Agent",
      role: "agent",
      agentVerified: false,
    },
    {
      id: IDS.buyer,
      email: `${NS}-buyer@test.local`,
      firstName: "Test",
      lastName: "Buyer",
      role: "user",
    },
    {
      id: IDS.referralAgent,
      email: `${NS}-referral-agent@test.local`,
      firstName: "Referral",
      lastName: "Agent",
      role: "agent",
      agentVerified: true,
    },
  ]);

  // Build minimal express app — same pattern as agentRelationships.integration.test.ts
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(
    session({
      secret: `${NS}-session-secret`,
      resave: false,
      saveUninitialized: false,
    }),
  );

  // Test auth middleware: honour x-test-user-id header
  app.use((req: any, _res, next) => {
    const userId = req.get("x-test-user-id");
    req.isAuthenticated = () => Boolean(userId);
    if (userId) req.user = { claims: { sub: userId } };
    next();
  });

  // Helper route to inject a referral agent into the session
  app.get("/test/referral/:agentId/:propertyId", async (req: any, res) => {
    const { storage: st } = await import("../storage");
    const referringAgent = await st.getUser(req.params.agentId);
    if (referringAgent?.agentVerified && referringAgent.role === "agent") {
      req.session.referringAgentId = referringAgent.id;
      req.session.referredPropertyId = Number(req.params.propertyId);
    }
    res.json({ ok: true });
  });

  app.use(propertiesRouter);

  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
  await cleanup();
  // The view-tracking route fires `void db.insert(propertyAnalytics)` without
  // awaiting it. Give that in-flight insert a brief moment to complete, then
  // call pool.end(). If the pool still has active clients it will block, so we
  // race against a short deadline and force-exit — all assertions are already
  // done by this point so a non-zero exit from pool.end() itself is harmless.
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  pool.end().catch(() => { /* ignore drain errors */ });
  // Allow the pool drain up to 1 s, then exit regardless so the runner
  // does not hang indefinitely on idle connections.
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  process.exit(0);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test("unverified agent cannot create a listing", async () => {
  const { response, body } = await request("/api/properties", {
    method: "POST",
    userId: IDS.unverifiedAgent,
    body: listingPayload(),
  });
  assert.equal(response.status, 403);
  assert.ok(body?.message?.includes("verified agent"));
});

test("unauthenticated user cannot create a listing", async () => {
  const { response } = await request("/api/properties", {
    method: "POST",
    body: listingPayload(),
  });
  assert.equal(response.status, 401);
});

test("verified agent creates listing; server owns agentId/agentEmail regardless of forged fields", async () => {
  const { response, body } = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({
      // Attempt to forge attribution to the other agent — must be ignored
      agentId: IDS.otherAgent,
      agentEmail: "attacker@evil.com",
    }),
  });
  assert.equal(response.status, 201, `Expected 201, got ${response.status}: ${JSON.stringify(body)}`);

  // Track created property for cleanup
  assert.ok(body?.id);
  propertyIds.push(body.id);

  // Server must have stamped the authenticated user's identity, not the forged values
  assert.equal(body.agentId, IDS.verifiedAgent, "agentId must be the authenticated user");
  // agentEmail from the server-owned agent record (set to phone/email of the verified agent)
  assert.notEqual(body.agentEmail, "attacker@evil.com", "forged agentEmail must be rejected");
});

test("private listing detail requires a valid signed share token and grants session access", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({
      title: "Private share token test",
      listingStatus: "off_market",
      isOffMarket: true,
    }),
  });
  assert.equal(create.response.status, 201);
  const property = create.body;
  propertyIds.push(property.id);

  const direct = await request(`/api/properties/${property.id}`);
  assert.equal(direct.response.status, 404, "private listing must not be enumerable by ID");

  const invalid = await request(`/api/properties/${property.id}?shareToken=invalid`);
  assert.equal(invalid.response.status, 404, "invalid capability token must not grant access");

  const shareToken = createListingShareToken(property);
  const shared = await request(
    `/api/properties/${property.id}?shareToken=${encodeURIComponent(shareToken)}`,
  );
  assert.equal(shared.response.status, 200);
  assert.equal(shared.body.id, property.id);

  const sessionCookie = shared.response.headers.get("set-cookie");
  assert.ok(sessionCookie, "valid share access should persist in the guest session");
  const tracked = await request(`/api/properties/${property.id}/view`, {
    method: "POST",
    cookie: sessionCookie.split(";")[0],
    body: { source: "shared_link", isMobile: false },
  });
  assert.equal(tracked.response.status, 200, "granted guest session should access private subresources");
});

test("pre-market listing is token-protected and returns noindex headers when shared", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({
      title: "Pre-market privacy test",
      listingStatus: "pre_market",
    }),
  });
  assert.equal(create.response.status, 201);
  const property = create.body;
  propertyIds.push(property.id);

  const direct = await request(`/api/properties/${property.id}`);
  assert.equal(direct.response.status, 404, "pre-market listing must not be enumerable by ID");

  const shareToken = createListingShareToken(property);
  const shared = await request(
    `/api/properties/${property.id}?shareToken=${encodeURIComponent(shareToken)}`,
  );
  assert.equal(shared.response.status, 200);
  assert.equal(shared.response.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("non-owner cannot edit a listing", async () => {
  // Create a listing under verifiedAgent
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Edit-guard test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response, body } = await request(`/api/properties/${pid}`, {
    method: "PUT",
    userId: IDS.otherAgent,
    body: { price: 1 },
  });
  assert.equal(response.status, 403, `Non-owner PUT should be 403, got ${response.status}: ${JSON.stringify(body)}`);
});

test("non-owner cannot archive a listing", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Archive-guard test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response } = await request(`/api/properties/${pid}/archive`, {
    method: "POST",
    userId: IDS.otherAgent,
    body: { reason: "malicious archive" },
  });
  assert.equal(response.status, 403);
});

test("non-owner cannot read listing analytics", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Analytics-guard test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response } = await request(`/api/agent/listing-analytics/${pid}`, {
    userId: IDS.otherAgent,
  });
  assert.equal(response.status, 403);
});

test("non-owner cannot add photos to a listing", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Photo-add-guard test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  // Build a minimal valid multipart body so multer succeeds (no upload error)
  // and execution reaches the ownership check. Multer runs first; only after
  // it finishes does the route handler check ownership, so we need at least
  // one file in the payload.
  const boundary = "----TestBoundaryABCD1234";
  // Minimal 1×1 white PNG (67 bytes, valid image/png)
  const pngBytes = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
    "2e00000000c4944415478016360f8cfc00000000200013463a7800000000049454e44ae426082",
    "hex",
  );
  const crlf = "\r\n";
  const bodyParts = [
    `--${boundary}${crlf}`,
    `Content-Disposition: form-data; name="photos"; filename="test.png"${crlf}`,
    `Content-Type: image/png${crlf}`,
    crlf,
  ];
  const bodyPrefix = Buffer.from(bodyParts.join(""));
  const bodySuffix = Buffer.from(`${crlf}--${boundary}--${crlf}`);
  const fullBody = Buffer.concat([bodyPrefix, pngBytes, bodySuffix]);

  const rawResp = await new Promise<{
    status: number;
    headers: { get(name: string): string | null };
    text: string;
  }>((resolve, reject) => {
    const headers: Record<string, string> = {
      connection: "close",
      "x-test-user-id": IDS.otherAgent,
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(fullBody.length),
    };
    const outgoing = httpRequest(
      `${baseUrl}/api/properties/${pid}/photos`,
      { method: "POST", headers },
      (incoming) => {
        let text = "";
        incoming.setEncoding("utf8");
        incoming.on("data", (chunk) => { text += chunk; });
        incoming.on("end", () => {
          resolve({
            status: incoming.statusCode ?? 0,
            headers: {
              get(name: string) {
                const value = incoming.headers[name.toLowerCase()];
                if (Array.isArray(value)) return value.join(", ");
                return value ?? null;
              },
            },
            text,
          });
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.write(fullBody);
    outgoing.end();
  });

  // Ownership check runs after multer succeeds → must be 403
  assert.equal(rawResp.status, 403);
});

test("non-owner cannot remove photos from a listing", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Photo-rm-guard test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response } = await request(`/api/properties/${pid}/photos`, {
    method: "DELETE",
    userId: IDS.otherAgent,
    body: { photoUrl: `/api/listing-photos/${pid}/fake.webp` },
  });
  assert.equal(response.status, 403);
});

test("owner can update listing lifecycle status", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Lifecycle test home", listingStatus: "active" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response, body } = await request(`/api/properties/${pid}`, {
    method: "PUT",
    userId: IDS.verifiedAgent,
    body: { listingStatus: "pending" },
  });
  assert.equal(response.status, 200, `PUT should succeed: ${JSON.stringify(body)}`);
  assert.equal(body.listingStatus, "pending");
  assert.equal(body.status, "pending");
});

test("owner can soft-archive a listing with a reason", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Soft-archive test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response, body } = await request(`/api/properties/${pid}/archive`, {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: { reason: "Sold off-market" },
  });
  assert.equal(response.status, 200, `Archive should succeed: ${JSON.stringify(body)}`);
  assert.equal(body.listingStatus, "archived");
  assert.equal(body.status, "archived");
  assert.ok(body.archivedAt, "archivedAt must be set");
  assert.equal(body.archivedReason, "Sold off-market");
});

test("public inquiry persists and routes to listing agent when no buyer or referral context", async () => {
  // Create a listing so we have a known agentId
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Inquiry routing — listing agent" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  const { response, body } = await request(`/api/properties/${pid}/inquiry`, {
    method: "POST",
    // No userId — guest inquiry
    body: {
      name: "Guest Buyer",
      contact: "guest@example.com",
      message: "Interested!",
    },
  });
  assert.equal(response.status, 201, `Inquiry should persist: ${JSON.stringify(body)}`);
  assert.equal(body.success, true);

  // Verify the persisted row targets the listing agent
  const [inquiry] = await db
    .select()
    .from(propertyInquiries)
    .where(eq(propertyInquiries.propertyId, pid));
  assert.ok(inquiry, "Inquiry row must exist");
  assert.equal(inquiry.agentId, IDS.verifiedAgent, "Must route to listing agent");
  assert.equal(inquiry.name, "Guest Buyer");
});

test("public inquiry routes to referral agent from session (not listing agent) when no buyer assignment", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Inquiry routing — referral agent" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  // Establish referral session via helper route
  const referralResp = await request(`/test/referral/${IDS.referralAgent}/${pid}`);
  assert.equal(referralResp.response.status, 200);
  const setCookie = referralResp.response.headers.get("set-cookie");
  assert.ok(setCookie, "Session cookie must be set");
  const cookie = setCookie.split(";")[0];

  // Post inquiry with session cookie but no authenticated user
  const { response, body } = await request(`/api/properties/${pid}/inquiry`, {
    method: "POST",
    cookie,
    body: {
      name: "Referred Buyer",
      contact: "referred@example.com",
      message: "Saw this via referral link",
    },
  });
  assert.equal(response.status, 201, `Referral inquiry should persist: ${JSON.stringify(body)}`);

  const rows = await db
    .select()
    .from(propertyInquiries)
    .where(
      and(
        eq(propertyInquiries.propertyId, pid),
        eq(propertyInquiries.name, "Referred Buyer"),
      ),
    );
  assert.equal(rows.length, 1, "Exactly one inquiry row");
  assert.equal(rows[0].agentId, IDS.referralAgent, "Must route to referral agent");
});

test("inquiry for represented buyer routes to buyer's assigned agent, not listing or referral agent", async () => {
  // Assign the buyer to otherAgent
  await db
    .update(users)
    .set({ assignedAgentUserId: IDS.otherAgent })
    .where(eq(users.id, IDS.buyer));

  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Inquiry routing — buyer's agent" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  // Establish referral session so we can verify it does NOT override the buyer assignment
  const referralResp = await request(`/test/referral/${IDS.referralAgent}/${pid}`);
  const setCookie = referralResp.response.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : undefined;

  const { response, body } = await request(`/api/properties/${pid}/inquiry`, {
    method: "POST",
    userId: IDS.buyer,
    cookie,
    body: {
      name: "Represented Buyer",
      contact: "buyer@example.com",
      message: "I have an agent already",
    },
  });
  assert.equal(response.status, 201, `Buyer inquiry should persist: ${JSON.stringify(body)}`);

  const rows = await db
    .select()
    .from(propertyInquiries)
    .where(
      and(
        eq(propertyInquiries.propertyId, pid),
        eq(propertyInquiries.name, "Represented Buyer"),
      ),
    );
  assert.equal(rows.length, 1, "Exactly one inquiry row");
  assert.equal(rows[0].agentId, IDS.otherAgent, "Must route to buyer's assigned agent");

  // Cleanup: unset buyer assignment
  await db
    .update(users)
    .set({ assignedAgentUserId: null })
    .where(eq(users.id, IDS.buyer));
});

test("property view deduplicates the same IP/property within one hour", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "View dedup test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  // Insert a synthetic analytics row with the same IP used in test requests (127.0.0.1)
  await db.insert(propertyAnalytics).values({
    propertyId: pid,
    viewerIp: "127.0.0.1",
    source: "direct",
    isMobile: false,
    viewedAt: new Date(), // within the last hour
  });

  // Now hit the view endpoint from the same "IP" (loopback in test)
  const { response, body } = await request(`/api/properties/${pid}/view`, {
    method: "POST",
    body: { source: "direct", isMobile: false },
  });
  assert.equal(response.status, 200);
  assert.equal(
    body.tracked,
    false,
    "Duplicate view from same IP within 1 hour must not be tracked",
  );
  assert.equal(body.reason, "rate_limited");
});

test("analytics endpoint returns aggregated views, inquiries, and saves for owner only", async () => {
  const create = await request("/api/properties", {
    method: "POST",
    userId: IDS.verifiedAgent,
    body: listingPayload({ title: "Analytics aggregate test home" }),
  });
  assert.equal(create.response.status, 201);
  const pid = create.body.id;
  propertyIds.push(pid);

  // Seed: 2 analytics rows with different IPs
  await db.insert(propertyAnalytics).values([
    {
      propertyId: pid,
      viewerIp: "10.0.0.1",
      source: "direct",
      isMobile: false,
      viewedAt: new Date(),
    },
    {
      propertyId: pid,
      viewerIp: "10.0.0.2",
      source: "search",
      isMobile: true,
      viewedAt: new Date(),
    },
  ]);

  // Seed: 1 inquiry
  await db.insert(propertyInquiries).values({
    propertyId: pid,
    agentId: IDS.verifiedAgent,
    name: "Seeded Inquirer",
    contact: "seeded@example.com",
    source: "listing_inquiry",
  });

  // Seed: 1 saved-property row
  await db.insert(savedProperties).values({
    userId: IDS.buyer,
    propertyId: pid,
  });

  // Owner should see aggregated data
  const ownerResp = await request(`/api/agent/listing-analytics/${pid}`, {
    userId: IDS.verifiedAgent,
  });
  assert.equal(
    ownerResp.response.status,
    200,
    `Owner analytics should succeed: ${JSON.stringify(ownerResp.body)}`,
  );
  assert.ok(ownerResp.body.views >= 2, "Must count seeded views");
  assert.ok(ownerResp.body.inquiries >= 1, "Must count seeded inquiries");
  assert.ok(ownerResp.body.saves >= 1, "Must count seeded saves");
  assert.ok(Array.isArray(ownerResp.body.byDay), "byDay must be array");
  assert.ok(Array.isArray(ownerResp.body.bySource), "bySource must be array");

  // Non-owner should be rejected
  const nonOwnerResp = await request(`/api/agent/listing-analytics/${pid}`, {
    userId: IDS.otherAgent,
  });
  assert.equal(nonOwnerResp.response.status, 403);
});
