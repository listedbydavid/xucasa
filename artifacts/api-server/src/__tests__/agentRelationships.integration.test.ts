import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import test, { after, before } from "node:test";
import express from "express";
import session from "express-session";
import { and, eq, inArray } from "drizzle-orm";
import {
  buyerInterest,
  clientAgentLinks,
  conversations,
  notifications,
  properties,
  propertyOffers,
  savedProperties,
  showingRequests,
  users,
} from "@workspace/db";
import { db, pool } from "../db";
import { storage } from "../storage";

const IDS = {
  agentA: "task32-integration-agent-a",
  agentB: "task32-integration-agent-b",
  client: "task32-integration-client",
  raceBuyer: "task32-integration-race-buyer",
  offerBuyer: "task32-integration-offer-buyer",
};

const TEST_USER_IDS = Object.values(IDS);
const TEST_IDX_ID = "task32-integration-property";

let baseUrl = "";
let propertyId = 0;
let server: ReturnType<typeof createServer>;
let previousNodeEnv: string | undefined;

async function cleanup(): Promise<void> {
  const testProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.idxId, TEST_IDX_ID));
  const propertyIds = testProperties.map((property) => property.id);

  if (propertyIds.length > 0) {
    await db.delete(showingRequests).where(inArray(showingRequests.propertyId, propertyIds));
    await db.delete(conversations).where(inArray(conversations.propertyId, propertyIds));
    await db.delete(propertyOffers).where(inArray(propertyOffers.propertyId, propertyIds));
    await db.delete(buyerInterest).where(inArray(buyerInterest.propertyId, propertyIds));
    await db.delete(savedProperties).where(inArray(savedProperties.propertyId, propertyIds));
    await db.delete(notifications).where(inArray(notifications.propertyId, propertyIds));
    await db.delete(properties).where(inArray(properties.id, propertyIds));
  }

  await db.delete(notifications).where(inArray(notifications.userId, TEST_USER_IDS));
  await db.delete(clientAgentLinks).where(inArray(clientAgentLinks.clientId, [
    IDS.client,
    IDS.raceBuyer,
    IDS.offerBuyer,
  ]));
  await db.delete(users).where(inArray(users.id, [
    IDS.client,
    IDS.raceBuyer,
    IDS.offerBuyer,
  ]));
  await db.delete(users).where(inArray(users.id, [IDS.agentA, IDS.agentB]));
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

  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  if (payload) headers["content-length"] = String(Buffer.byteLength(payload));

  const response = await new Promise<{
    status: number;
    headers: { get(name: string): string | null };
    text: string;
  }>((resolve, reject) => {
    const outgoing = httpRequest(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
    }, (incoming) => {
      let text = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => {
        text += chunk;
      });
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
    });
    outgoing.on("error", reject);
    if (payload) outgoing.write(payload);
    outgoing.end();
  });
  const body = response.text ? JSON.parse(response.text) : null;
  return { response, body };
}

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const [
    { default: agentRelationshipsRouter },
    { default: agentClientsRouter },
  ] = await Promise.all([
    import("../routes/agentRelationships"),
    import("../routes/agentClients"),
  ]);

  await cleanup();

  await db.insert(users).values([
    {
      id: IDS.agentA,
      email: "task32-agent-a@example.com",
      firstName: "Agent",
      lastName: "Alpha",
      role: "agent",
      agentVerified: true,
      brokerageName: "Alpha Realty",
    },
    {
      id: IDS.agentB,
      email: "task32-agent-b@example.com",
      firstName: "Agent",
      lastName: "Beta",
      role: "agent",
      agentVerified: true,
      brokerageName: "Beta Realty",
    },
    {
      id: IDS.client,
      email: "task32-client@example.com",
      firstName: "Client",
      lastName: "Buyer",
      role: "user",
    },
    {
      id: IDS.raceBuyer,
      email: "task32-race-buyer@example.com",
      firstName: "Race",
      lastName: "Buyer",
      role: "user",
    },
    {
      id: IDS.offerBuyer,
      email: "task32-offer-buyer@example.com",
      firstName: "Offer",
      lastName: "Buyer",
      role: "user",
    },
  ]);

  const [property] = await db
    .insert(properties)
    .values({
      title: "Task 32 Integration Home",
      description: "Relationship route integration fixture",
      price: 750_000,
      location: "San Diego, CA",
      beds: 3,
      baths: "2",
      sqft: 1_600,
      agentId: IDS.agentA,
      listingAgentName: "Agent Alpha",
      listingAgentEmail: "task32-agent-a@example.com",
      idxId: TEST_IDX_ID,
    })
    .returning({ id: properties.id });
  propertyId = property.id;

  assert.equal(await storage.assignAgent(IDS.client, IDS.agentA), true);

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(session({
    secret: "task32-integration-session-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.use((req: any, _res, next) => {
    const userId = req.get("x-test-user-id");
    req.isAuthenticated = () => Boolean(userId);
    if (userId) req.user = { claims: { sub: userId } };
    next();
  });
  app.get("/test/referral/:agentId/:propertyId", async (req: any, res) => {
    const referringAgent = await storage.getUser(req.params.agentId);
    if (referringAgent?.agentVerified && referringAgent.role === "agent") {
      req.session.referringAgentId = referringAgent.id;
      req.session.referredPropertyId = Number(req.params.propertyId);
    }
    res.json({ ok: true });
  });
  app.use(agentRelationshipsRouter);
  app.use(agentClientsRouter);

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
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
  await cleanup();
  await pool.end();
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test("concurrent buyer links preserve the first real agent and matching active link", async () => {
  const [first, second] = await Promise.all([
    request("/api/buyer/link-agent", {
      method: "POST",
      userId: IDS.raceBuyer,
      body: { agentUserId: IDS.agentA },
    }),
    request("/api/buyer/link-agent", {
      method: "POST",
      userId: IDS.raceBuyer,
      body: { agentUserId: IDS.agentB },
    }),
  ]);

  assert.deepEqual(
    [first.response.status, second.response.status].sort((a, b) => a - b),
    [200, 409],
  );

  const [buyer] = await db
    .select({ assignedAgentUserId: users.assignedAgentUserId })
    .from(users)
    .where(eq(users.id, IDS.raceBuyer));
  const [link] = await db
    .select()
    .from(clientAgentLinks)
    .where(eq(clientAgentLinks.clientId, IDS.raceBuyer));

  assert.ok(buyer.assignedAgentUserId === IDS.agentA || buyer.assignedAgentUserId === IDS.agentB);
  assert.equal(link.agentId, buyer.assignedAgentUserId);
  assert.equal(link.status, "active");
});

test("offer authority exists only after an agent assignment is persisted", async () => {
  const beforeAssignment = await storage.lookupAssignedAgent(IDS.offerBuyer);
  assert.equal(beforeAssignment, null);

  const resolvedAgent = await storage.resolveAndAssignAgent(IDS.offerBuyer);
  assert.ok(resolvedAgent?.id);

  const [buyer] = await db
    .select({ assignedAgentUserId: users.assignedAgentUserId })
    .from(users)
    .where(eq(users.id, IDS.offerBuyer));
  assert.equal(buyer.assignedAgentUserId, resolvedAgent.id);

  const authoritativeAgent = await storage.lookupAssignedAgent(IDS.offerBuyer);
  assert.equal(authoritativeAgent?.id, buyer.assignedAgentUserId);
});

test("offer reads follow the buyer's current assignment, not historical metadata", async () => {
  const historicalOffer = await storage.createPropertyOffer({
    propertyId,
    buyerUserId: IDS.client,
    buyerAgentId: IDS.agentB,
    listingAgentId: null,
    status: "pending_agent_review",
    triggeredBySwipe: false,
  });

  const formerAgentOffers = await storage.getPropertyOffersForAgent(IDS.agentB);
  const currentAgentOffers = await storage.getPropertyOffersForAgent(IDS.agentA);

  assert.equal(
    formerAgentOffers.some(offer => offer.id === historicalOffer.id),
    false,
  );
  assert.equal(
    currentAgentOffers.some(offer => offer.id === historicalOffer.id),
    true,
  );
});

test("conversation and showing lists reject a former historical agent", async () => {
  const historicalConversation = await storage.getOrCreateConversation(
    propertyId,
    IDS.client,
    IDS.agentB,
    "agent",
    "buyer",
  );
  const historicalShowing = await storage.createShowingRequest({
    conversationId: historicalConversation.id,
    propertyId,
    buyerUserId: IDS.client,
    agentUserId: IDS.agentB,
    requestedDates: ["2026-09-01T17:00:00.000Z"],
    status: "requested",
  });

  const formerAgentConversations = await storage.getConversationsForUser(IDS.agentB);
  const currentAgentConversations = await storage.getConversationsForUser(IDS.agentA);
  const formerAgentShowings = await storage.getShowingRequestsForUser(IDS.agentB);
  const currentAgentShowings = await storage.getShowingRequestsForUser(IDS.agentA);

  assert.equal(
    formerAgentConversations.some(conversation => conversation.id === historicalConversation.id),
    false,
  );
  assert.equal(
    currentAgentConversations.some(conversation => conversation.id === historicalConversation.id),
    true,
  );
  assert.equal(
    formerAgentShowings.some(showing => showing.id === historicalShowing.id),
    false,
  );
  assert.equal(
    currentAgentShowings.some(showing => showing.id === historicalShowing.id),
    true,
  );
});

test("buyer-interest access follows current assignment, not stored history", async () => {
  const historicalInterest = await storage.upsertBuyerInterest(
    propertyId,
    IDS.client,
    "swipe",
    IDS.agentB,
    IDS.agentA,
  );

  const formerAgentInterests = await storage.getBuyerInterestForAgent(IDS.agentB);
  const currentAgentInterests = await storage.getBuyerInterestForAgent(IDS.agentA);

  assert.equal(
    formerAgentInterests.some(interest => interest.id === historicalInterest.id),
    false,
  );
  assert.equal(
    currentAgentInterests.some(interest => interest.id === historicalInterest.id),
    true,
  );
});

test("send-listing enforces the active client relationship and deduplicates saves", async () => {
  // Simulate a stale pre-migration link that disagrees with the authoritative
  // buyer assignment. It must not grant Agent B access.
  await db.insert(clientAgentLinks).values({
    clientId: IDS.client,
    agentEmail: "task32-agent-b@example.com",
    agentId: IDS.agentB,
    status: "active",
  });

  const denied = await request("/api/agent/send-listing", {
    method: "POST",
    userId: IDS.agentB,
    body: { clientUserId: IDS.client, propertyId },
  });
  assert.equal(denied.response.status, 403);

  const staleList = await request("/api/agent-clients", { userId: IDS.agentB });
  assert.equal(staleList.response.status, 200);
  assert.equal(
    staleList.body.some((entry: any) => entry.clientId === IDS.client),
    false,
  );

  const staleFavorites = await request(
    `/api/agent-clients/${IDS.client}/favorites`,
    { userId: IDS.agentB },
  );
  const staleSearches = await request(
    `/api/agent-clients/${IDS.client}/searches`,
    { userId: IDS.agentB },
  );
  assert.equal(staleFavorites.response.status, 403);
  assert.equal(staleSearches.response.status, 403);

  const legacyRelink = await request("/api/agent-invite", {
    method: "POST",
    userId: IDS.client,
    body: { agentEmail: "task32-agent-b@example.com" },
  });
  const legacyDelete = await request("/api/agent-invite", {
    method: "DELETE",
    userId: IDS.client,
  });
  assert.equal(legacyRelink.response.status, 409);
  assert.equal(legacyDelete.response.status, 409);

  const firstSend = await request("/api/agent/send-listing", {
    method: "POST",
    userId: IDS.agentA,
    body: { clientUserId: IDS.client, propertyId, note: "Worth a look" },
  });
  const secondSend = await request("/api/agent/send-listing", {
    method: "POST",
    userId: IDS.agentA,
    body: { clientUserId: IDS.client, propertyId },
  });
  assert.equal(firstSend.response.status, 200);
  assert.equal(secondSend.response.status, 200);

  const assignedList = await request("/api/agent-clients", { userId: IDS.agentA });
  const assignedFavorites = await request(
    `/api/agent-clients/${IDS.client}/favorites`,
    { userId: IDS.agentA },
  );
  const assignedSearches = await request(
    `/api/agent-clients/${IDS.client}/searches`,
    { userId: IDS.agentA },
  );
  assert.equal(assignedList.response.status, 200);
  assert.equal(
    assignedList.body.some((entry: any) => entry.clientId === IDS.client),
    true,
  );
  assert.equal(assignedFavorites.response.status, 200);
  assert.equal(assignedSearches.response.status, 200);

  const saves = await db
    .select()
    .from(savedProperties)
    .where(and(
      eq(savedProperties.userId, IDS.client),
      eq(savedProperties.propertyId, propertyId),
    ));
  assert.equal(saves.length, 1);
});

test("verified referral resolves for guests but never overrides a represented buyer", async () => {
  const referralPage = await request(`/test/referral/${IDS.agentB}/${propertyId}`);
  assert.equal(referralPage.response.status, 200);
  const setCookie = referralPage.response.headers.get("set-cookie");
  assert.ok(setCookie);
  const cookie = setCookie.split(";")[0];

  const guestContact = await request(`/api/properties/${propertyId}/contact-agent`, { cookie });
  assert.equal(guestContact.response.status, 200);
  assert.equal(guestContact.body.agentType, "listing_agent");
  assert.equal(guestContact.body.agent.id, IDS.agentB);

  const representedContact = await request(`/api/properties/${propertyId}/contact-agent`, {
    cookie,
    userId: IDS.client,
  });
  assert.equal(representedContact.response.status, 200);
  assert.equal(representedContact.body.agentType, "buyers_agent");
  assert.equal(representedContact.body.agent.id, IDS.agentA);
});

test("share URLs require listing ownership and ignore request-controlled hosts", async () => {
  const previousOrigins = {
    frontend: process.env.FRONTEND_ORIGIN,
    public: process.env.PUBLIC_ORIGIN,
    app: process.env.APP_URL,
  };
  process.env.FRONTEND_ORIGIN = "https://trusted.example";

  try {
    const denied = await request(`/api/agent/listing-share-url/${propertyId}`, {
      userId: IDS.agentB,
    });
    assert.equal(denied.response.status, 403);

    const allowed = await request(`/api/agent/listing-share-url/${propertyId}`, {
      userId: IDS.agentA,
      headers: {
        host: "attacker.example",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(
      allowed.body.shareUrl,
      `https://trusted.example/property/${propertyId}?agent=${IDS.agentA}`,
    );

    delete process.env.FRONTEND_ORIGIN;
    delete process.env.PUBLIC_ORIGIN;
    delete process.env.APP_URL;

    const unconfigured = await request(`/api/agent/listing-share-url/${propertyId}`, {
      userId: IDS.agentA,
      headers: {
        host: "attacker.example",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(unconfigured.response.status, 503);
    assert.equal(unconfigured.body.message, "Listing share links are not configured");
  } finally {
    if (previousOrigins.frontend === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previousOrigins.frontend;
    if (previousOrigins.public === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = previousOrigins.public;
    if (previousOrigins.app === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousOrigins.app;
  }
});