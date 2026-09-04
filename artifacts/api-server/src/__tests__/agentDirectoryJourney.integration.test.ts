import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import test, { after, before } from "node:test";
import express from "express";
import { inArray } from "drizzle-orm";
import { agentPublicProfiles, properties, users } from "@workspace/db";
import { db, pool } from "../db";

const IDS = {
  viewer: "agent-directory-journey-viewer",
  target: "agent-directory-journey-target",
  unverified: "agent-directory-journey-unverified",
};
const USER_IDS = Object.values(IDS);
let baseUrl = "";
let server: ReturnType<typeof createServer>;
let propertyIds: number[] = [];

async function cleanup() {
  if (propertyIds.length) {
    await db.delete(properties).where(inArray(properties.id, propertyIds));
  }
  await db.delete(agentPublicProfiles).where(inArray(agentPublicProfiles.userId, USER_IDS));
  await db.delete(users).where(inArray(users.id, USER_IDS));
  propertyIds = [];
}

async function request(path: string, options: { method?: string; userId?: string; body?: unknown } = {}) {
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const headers: Record<string, string> = {
    connection: "close",
    ...(options.userId ? { "x-test-user-id": options.userId } : {}),
    ...(payload === undefined ? {} : {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(payload)),
    }),
  };
  const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const outgoing = httpRequest(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
    }, incoming => {
      let text = "";
      incoming.setEncoding("utf8");
      incoming.on("data", chunk => { text += chunk; });
      incoming.on("end", () => resolve({ status: incoming.statusCode ?? 0, text }));
    });
    outgoing.on("error", reject);
    if (payload) outgoing.write(payload);
    outgoing.end();
  });
  return { status: response.status, body: response.text ? JSON.parse(response.text) : null };
}

before(async () => {
  process.env.NODE_ENV = "production";
  const { default: agentPublicProfilesRouter } = await import("../routes/agentPublicProfiles");

  await cleanup();
  await db.insert(users).values([
    {
      id: IDS.viewer,
      email: "directory-viewer@test.local",
      firstName: "Verified",
      lastName: "Viewer",
      role: "agent",
      agentVerified: true,
    },
    {
      id: IDS.target,
      email: "directory-target@test.local",
      firstName: "Directory",
      lastName: "Target",
      role: "agent",
      agentVerified: true,
      agentMlsId: "DIRECTORY-MLS-1",
      licenseNumber: "DRE-DIRECTORY-1",
      licenseState: "CA",
    },
    {
      id: IDS.unverified,
      email: "directory-unverified@test.local",
      firstName: "Pending",
      lastName: "Agent",
      role: "agent",
      agentVerified: false,
    },
  ]);
  await db.insert(agentPublicProfiles).values({
    userId: IDS.target,
    mlsDisplayName: "MLS Directory Target",
    mlsEmail: "mls-target@test.local",
    mlsBrokerageName: "Journey Realty",
  });
  const inserted = await db.insert(properties).values([
    {
      title: "Current directory home",
      description: "Current listing used by the native directory journey",
      price: 900_000,
      location: "San Diego, CA",
      beds: 3,
      baths: "2",
      sqft: 1600,
      status: "active",
      listingStatus: "active",
      agentId: IDS.target,
      listDate: new Date(),
    },
    {
      title: "Historical directory home",
      description: "Historical sale used by the native directory journey",
      price: 850_000,
      closePrice: 840_000,
      location: "La Mesa, CA",
      beds: 2,
      baths: "2",
      sqft: 1300,
      status: "sold",
      listingStatus: "sold",
      listingAgentMlsId: "DIRECTORY-MLS-1",
      listDate: new Date(),
      closeDate: new Date(),
    },
  ]).returning({ id: properties.id });
  propertyIds = inserted.map(row => row.id);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const userId = req.get("x-test-user-id");
    req.isAuthenticated = () => Boolean(userId);
    if (userId) req.user = { claims: { sub: userId } };
    next();
  });
  app.use(agentPublicProfilesRouter);
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  await cleanup();
  await pool.end();
});

test("verified agent searches the directory and opens current and historical native property data", async () => {
  const directory = await request("/api/agents/directory?q=Journey%20Realty", { userId: IDS.viewer });
  assert.equal(directory.status, 200, JSON.stringify(directory.body));
  assert.equal(directory.body.total, 1);
  assert.equal(directory.body.agents[0].id, IDS.target);
  assert.equal(directory.body.agents[0].currentListingsCount, 1);
  assert.equal(directory.body.agents[0].salesYtdCount, 1);

  const profile = await request(`/api/agents/${IDS.target}/profile`, { userId: IDS.viewer });
  assert.equal(profile.status, 200, JSON.stringify(profile.body));
  assert.equal(profile.body.currentListings[0].id, propertyIds[0]);
  assert.equal(profile.body.salesYtd[0].id, propertyIds[1]);

  const denied = await request("/api/agents/directory", { userId: IDS.unverified });
  assert.equal(denied.status, 403);
});

test("profile corrections and visibility persist across reload and an MLS snapshot refresh", async () => {
  const update = await request("/api/agent/public-profile", {
    method: "PATCH",
    userId: IDS.target,
    body: {
      displayNameOverride: "Corrected Directory Name",
      emailOverride: "corrected@test.local",
      showEmail: false,
      showPhone: false,
    },
  });
  assert.equal(update.status, 200, JSON.stringify(update.body));
  assert.equal(update.body.displayNameOverride, "Corrected Directory Name");
  assert.equal(update.body.resolvedPreview.email, null);

  const reload = await request("/api/agent/public-profile", { userId: IDS.target });
  assert.equal(reload.body.displayNameOverride, "Corrected Directory Name");
  assert.equal(reload.body.showEmail, false);
  assert.equal(reload.body.showPhone, false);

  const { persistAgentMlsSnapshot } = await import("../routes/agentPublicProfiles");
  await persistAgentMlsSnapshot(IDS.target, {
    mlsDisplayName: "New MLS Name",
    mlsEmail: "new-mls@test.local",
    mlsBrokerageName: "Refreshed Journey Realty",
    lastMlsSyncAt: new Date(),
    updatedAt: new Date(),
  });

  const afterRefresh = await request("/api/agent/public-profile", { userId: IDS.target });
  assert.equal(afterRefresh.body.mlsDisplayName, "New MLS Name");
  assert.equal(afterRefresh.body.displayNameOverride, "Corrected Directory Name");
  assert.equal(afterRefresh.body.emailOverride, "corrected@test.local");
  assert.equal(afterRefresh.body.showEmail, false);
  assert.equal(afterRefresh.body.showPhone, false);
  assert.equal(afterRefresh.body.resolvedPreview.displayName, "Corrected Directory Name");
  assert.equal(afterRefresh.body.resolvedPreview.email, null);
});