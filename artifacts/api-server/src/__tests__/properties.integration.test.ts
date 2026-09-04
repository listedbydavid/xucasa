import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test, { after, before } from "node:test";
import express from "express";
import { eq, inArray, like } from "drizzle-orm";
import { buyerInterest, buyerMatches, buyerProfiles, clientAgentLinks, conversations, messages, notifications, priceDropNotificationDeliveries, properties, propertyOffers, propertyReviews, savedProperties, sellLeads, sellerConcessions, showingRequests, swipeNotifications, users } from "@workspace/db";
import { db, pool } from "../db";

const IDS = {
  owner: "listing-integration-owner",
  other: "listing-integration-other",
  unverified: "listing-integration-unverified",
};
const USER_IDS = Object.values(IDS);
let baseUrl = "";
let server: ReturnType<typeof createServer>;
let listingId = 0;

async function cleanup() {
  const profiles = await db.select({ id: buyerProfiles.id }).from(buyerProfiles).where(inArray(buyerProfiles.userId, USER_IDS));
  const profileIds = profiles.map(profile => profile.id);
  if (profileIds.length) {
    await db.delete(buyerMatches).where(inArray(buyerMatches.buyerProfileId, profileIds));
    await db.delete(buyerProfiles).where(inArray(buyerProfiles.id, profileIds));
  }
  const rows = await db.select({ id: properties.id }).from(properties).where(inArray(properties.agentId, USER_IDS));
  const ids = rows.map(row => row.id);
  if (ids.length) {
    const relatedConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(inArray(conversations.propertyId, ids));
    const conversationIds = relatedConversations.map(conversation => conversation.id);
    await db.delete(showingRequests).where(inArray(showingRequests.propertyId, ids));
    await db.delete(buyerInterest).where(inArray(buyerInterest.propertyId, ids));
    await db.delete(buyerMatches).where(inArray(buyerMatches.propertyId, ids));
    await db.delete(swipeNotifications).where(inArray(swipeNotifications.propertyId, ids));
    await db.delete(propertyOffers).where(inArray(propertyOffers.propertyId, ids));
    await db.delete(savedProperties).where(inArray(savedProperties.propertyId, ids));
    await db.delete(propertyReviews).where(inArray(propertyReviews.propertyId, ids));
    await db.delete(notifications).where(inArray(notifications.propertyId, ids));
    await db.delete(priceDropNotificationDeliveries).where(inArray(priceDropNotificationDeliveries.propertyId, ids));
    await db.delete(sellerConcessions).where(inArray(sellerConcessions.propertyId, ids));
    if (conversationIds.length) {
      await db.delete(messages).where(inArray(messages.conversationId, conversationIds));
      await db.delete(conversations).where(inArray(conversations.id, conversationIds));
    }
    await db.delete(properties).where(inArray(properties.id, ids));
  }
  await db.delete(sellLeads).where(like(sellLeads.name, "Listing Integration%"));
  await db.delete(clientAgentLinks).where(
    inArray(clientAgentLinks.clientId, USER_IDS),
  );
  await db.delete(users).where(inArray(users.id, USER_IDS));
}

async function jsonRequest(pathname: string, options: { method?: string; userId?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: {
      ...(options.userId ? { "x-test-user-id": options.userId } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  process.env.NODE_ENV = "production";
  const [
    { default: propertiesRouter },
    { default: listingManagementRouter },
    { default: agentRelationshipsRouter },
    { default: savedRouter },
    { default: conversationsRouter },
    { default: buyerRouter },
    { default: reviewsRouter },
    { default: homeownerRouter },
    { default: concessionsRouter },
    { default: marketplaceRouter },
  ] = await Promise.all([
    import("../routes/properties"),
    import("../routes/listingManagement"),
    import("../routes/agentRelationships"),
    import("../routes/saved"),
    import("../routes/conversations"),
    import("../routes/buyer"),
    import("../routes/reviews"),
    import("../routes/homeowner"),
    import("../routes/concessions"),
    import("../routes/marketplace"),
  ]);
  await cleanup();
  await db.insert(users).values([
    { id: IDS.owner, email: "listing-owner@example.com", firstName: "Listing", lastName: "Owner", role: "agent", agentVerified: true },
    { id: IDS.other, email: "listing-other@example.com", firstName: "Other", lastName: "Agent", role: "agent", agentVerified: true },
    { id: IDS.unverified, email: "listing-unverified@example.com", firstName: "Pending", lastName: "Agent", role: "agent", agentVerified: false },
  ]);

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const userId = req.get("x-test-user-id");
    req.isAuthenticated = () => Boolean(userId);
    if (userId) req.user = { claims: { sub: userId } };
    next();
  });
  app.use(agentRelationshipsRouter);
  app.use(listingManagementRouter);
  app.use(savedRouter);
  app.use(conversationsRouter);
  app.use(buyerRouter);
  app.use(reviewsRouter);
  app.use(homeownerRouter);
  app.use(concessionsRouter);
  app.use(marketplaceRouter);
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
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
  await cleanup();
  await pool.end();
});

test("manual listing creation requires a verified agent", async () => {
  const result = await jsonRequest("/api/properties", {
    method: "POST",
    userId: IDS.unverified,
    body: { title: "Denied", description: "Denied", price: 1, location: "San Diego, CA", beds: 1, baths: "1", sqft: 1 },
  });
  assert.equal(result.status, 403);
});

test("owner draft is private, confidential, and publishable as coming soon", async () => {
  const created = await jsonRequest("/api/properties", {
    method: "POST",
    userId: IDS.owner,
    body: {
      title: "123 Harbor View Drive",
      description: "A complete integration listing",
      price: 1_250_000,
      location: "San Diego, CA",
      addressStreetNumber: "123",
      addressStreetName: "Harbor View Drive",
      addressCity: "San Diego",
      addressState: "CA",
      addressZip: "92101",
      beds: 3,
      baths: "2.5",
      sqft: 1750,
      propertyType: "SFH",
      status: "draft",
      confidentialRemarks: "Owner-only pricing strategy",
      showingInstructions: "Call before showing",
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  listingId = created.body.id;
  assert.equal(created.body.source, "manual");
  assert.equal(created.body.status, "draft");

  const [publicList, publicDetail, ownerDetail, deniedEdit] = await Promise.all([
    jsonRequest("/api/properties?status=coming_soon"),
    jsonRequest(`/api/properties/${listingId}`),
    jsonRequest(`/api/properties/${listingId}`, { userId: IDS.owner }),
    jsonRequest(`/api/properties/${listingId}`, { method: "PUT", userId: IDS.other, body: { price: 2_000_000 } }),
  ]);
  assert.equal(publicList.body.properties.some((property: any) => property.id === listingId), false);
  assert.equal(publicDetail.status, 404);
  assert.equal(ownerDetail.body.confidentialRemarks, "Owner-only pricing strategy");
  assert.equal(deniedEdit.status, 403);

  const [draftContact, draftTour] = await Promise.all([
    jsonRequest(`/api/properties/${listingId}/contact-agent`),
    jsonRequest(`/api/properties/${listingId}/tour-inquiry`, {
      method: "POST",
      body: { name: "Listing Integration Draft Guest", email: "draft@example.com" },
      headers: { "x-forwarded-for": "198.51.100.10" },
    }),
  ]);
  assert.equal(draftContact.status, 404);
  assert.equal(draftTour.status, 404);

  const [
    ownerConfidential,
    otherAgentConfidential,
    savedDraft,
    draftConversation,
    draftShowing,
    draftSwipe,
    draftSimilar,
    draftSoldNearby,
    draftRecords,
    draftSchools,
    draftZoning,
    draftReviews,
    draftLookup,
    draftAutocomplete,
  ] = await Promise.all([
    jsonRequest(`/api/properties/${listingId}/agent-mls`, { userId: IDS.owner }),
    jsonRequest(`/api/properties/${listingId}/agent-mls`, { userId: IDS.other }),
    jsonRequest("/api/saved-properties", { method: "POST", userId: IDS.other, body: { propertyId: listingId } }),
    jsonRequest("/api/conversations", { method: "POST", userId: IDS.other, body: { propertyId: listingId } }),
    jsonRequest("/api/showing-requests", { method: "POST", userId: IDS.other, body: { propertyId: listingId, requestedDates: ["2026-09-01"] } }),
    jsonRequest("/api/swipe-interest", { method: "POST", userId: IDS.other, body: { propertyId: listingId } }),
    jsonRequest(`/api/properties/${listingId}/similar`),
    jsonRequest(`/api/properties/${listingId}/sold-nearby`),
    jsonRequest(`/api/properties/${listingId}/public-records`),
    jsonRequest(`/api/properties/${listingId}/schools`),
    jsonRequest(`/api/properties/${listingId}/zoning`),
    jsonRequest(`/api/properties/${listingId}/reviews`),
    jsonRequest("/api/property-lookup?streetNumber=1234&streetName=Harbor%20View%20Drive&city=San%20Diego&state=CA&zip=92101"),
    jsonRequest("/api/properties/autocomplete?q=Harbor%20View%20Drive"),
  ]);
  assert.equal(ownerConfidential.status, 200);
  assert.equal(ownerConfidential.body.confidentialRemarks, "Owner-only pricing strategy");
  assert.equal(otherAgentConfidential.status, 404);
  for (const result of [savedDraft, draftConversation, draftShowing, draftSwipe, draftSimilar, draftSoldNearby, draftRecords, draftSchools, draftZoning, draftReviews]) {
    assert.equal(result.status, 404, JSON.stringify(result.body));
  }
  assert.equal(draftAutocomplete.body.some((property: any) => property.id === listingId), false);
  assert.equal(draftLookup.status, 200);
  assert.equal(draftLookup.body.found, false);

  const concessionCreated = await jsonRequest(`/api/properties/${listingId}/concessions`, {
    method: "POST",
    userId: IDS.owner,
    body: { headline: "Private seller incentive", closingCostFixed: 5000 },
  });
  assert.equal(concessionCreated.status, 201);
  const [hiddenConcession, ownerConcession, activeConcessions] = await Promise.all([
    jsonRequest(`/api/properties/${listingId}/concessions`),
    jsonRequest(`/api/properties/${listingId}/concessions`, { userId: IDS.owner }),
    jsonRequest("/api/concessions/active"),
  ]);
  assert.equal(hiddenConcession.status, 404);
  assert.equal(ownerConcession.status, 200);
  assert.equal(ownerConcession.body.concession.headline, "Private seller incentive");
  assert.equal(activeConcessions.body.concessions.some((row: any) => row.propertyId === listingId), false);
  await db.delete(sellerConcessions).where(eq(sellerConcessions.propertyId, listingId));

  const [buyerProfile] = await db.insert(buyerProfiles).values({
    userId: IDS.other,
    displayName: "Draft privacy buyer",
    preApprovalAmount: 900000,
  }).returning();
  await db.insert(buyerMatches).values({
    buyerProfileId: buyerProfile.id,
    propertyId: listingId,
    senderId: IDS.other,
    message: "Private draft pitch",
  });
  const [hiddenProfileMatches, hiddenSentMatches] = await Promise.all([
    jsonRequest(`/api/buyer-matches/profile/${buyerProfile.id}`, { userId: IDS.other }),
    jsonRequest("/api/buyer-matches/sent", { userId: IDS.other }),
  ]);
  assert.deepEqual(hiddenProfileMatches.body, []);
  assert.deepEqual(hiddenSentMatches.body, []);

  const invalidPhotos = await jsonRequest(`/api/properties/${listingId}`, {
    method: "PUT",
    userId: IDS.owner,
    body: { photos: Array.from({ length: 21 }, (_, index) => `https://example.com/${index}.jpg`) },
  });
  assert.equal(invalidPhotos.status, 400);

  const published = await jsonRequest(`/api/properties/${listingId}`, {
    method: "PUT",
    userId: IDS.owner,
    body: { status: "coming_soon" },
  });
  assert.equal(published.status, 200);
  assert.equal(published.body.status, "coming_soon");

  const [publicPublished, discovered, otherAgentPublishedConfidential] = await Promise.all([
    jsonRequest(`/api/properties/${listingId}`),
    jsonRequest("/api/properties?status=coming_soon"),
    jsonRequest(`/api/properties/${listingId}/agent-mls`, { userId: IDS.other }),
  ]);
  assert.equal(publicPublished.status, 200);
  assert.equal("confidentialRemarks" in publicPublished.body, false);
  assert.equal("showingInstructions" in publicPublished.body, false);
  assert.equal(discovered.body.properties.some((property: any) => property.id === listingId), true);
  assert.equal(otherAgentPublishedConfidential.status, 403);

  const [profileMatches, sentMatches] = await Promise.all([
    jsonRequest(`/api/buyer-matches/profile/${buyerProfile.id}`, { userId: IDS.other }),
    jsonRequest("/api/buyer-matches/sent", { userId: IDS.other }),
  ]);
  for (const matches of [profileMatches.body, sentMatches.body]) {
    assert.equal(matches.length, 1);
    assert.equal(matches[0].property.id, listingId);
    assert.equal(matches[0].property.confidentialRemarks, undefined);
  }
  await db.delete(buyerMatches).where(eq(buyerMatches.buyerProfileId, buyerProfile.id));
  await db.delete(buyerProfiles).where(eq(buyerProfiles.id, buyerProfile.id));
});

test("owner can upload, validate order, and remove an optimized photo", async () => {
  const madePrivate = await jsonRequest(`/api/properties/${listingId}`, {
    method: "PUT",
    userId: IDS.owner,
    body: { status: "draft" },
  });
  assert.equal(madePrivate.status, 200);

  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.append("photos", new Blob([image], { type: "image/png" }), "home.png");
  const uploadedResponse = await fetch(`${baseUrl}/api/properties/${listingId}/photos`, {
    method: "POST",
    headers: { "x-test-user-id": IDS.owner },
    body: form,
  });
  assert.equal(uploadedResponse.status, 201, await uploadedResponse.clone().text());
  const uploaded = await uploadedResponse.json() as any;
  assert.equal(uploaded.photos.length, 1);
  assert.match(uploaded.photos[0], /^\/api\/listing-photos\/[a-f0-9-]+\.webp$/);

  const [hiddenPhoto, ownerPhoto] = await Promise.all([
    fetch(`${baseUrl}${uploaded.photos[0]}`),
    fetch(`${baseUrl}${uploaded.photos[0]}`, { headers: { "x-test-user-id": IDS.owner } }),
  ]);
  assert.equal(hiddenPhoto.status, 404);
  assert.equal(ownerPhoto.status, 200);

  const republished = await jsonRequest(`/api/properties/${listingId}`, {
    method: "PUT",
    userId: IDS.owner,
    body: { status: "coming_soon" },
  });
  assert.equal(republished.status, 200);
  const publicPhoto = await fetch(`${baseUrl}${uploaded.photos[0]}`);
  assert.equal(publicPhoto.status, 200);

  const invalidReorder = await jsonRequest(`/api/properties/${listingId}/photos/reorder`, {
    method: "PUT",
    userId: IDS.owner,
    body: { photos: [] },
  });
  assert.equal(invalidReorder.status, 400);

  const denied = new FormData();
  denied.append("photos", new Blob([image], { type: "image/png" }), "other.png");
  const deniedResponse = await fetch(`${baseUrl}/api/properties/${listingId}/photos`, {
    method: "POST",
    headers: { "x-test-user-id": IDS.other },
    body: denied,
  });
  assert.equal(deniedResponse.status, 403);

  const removed = await jsonRequest(`/api/properties/${listingId}/photos`, {
    method: "DELETE",
    userId: IDS.owner,
    body: { url: uploaded.photos[0] },
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.photos, []);
});

test("public listing questions are accepted and rate limited", async () => {
  const statuses: number[] = [];
  for (let index = 0; index < 9; index++) {
    const result = await jsonRequest(`/api/properties/${listingId}/question-inquiry`, {
      method: "POST",
      body: {
        name: `Listing Integration Guest ${index}`,
        email: `guest${index}@example.com`,
        message: "Is the home available for a tour this weekend?",
      },
    });
    statuses.push(result.status);
  }
  assert.equal(statuses.filter(status => status === 200).length, 8, JSON.stringify(statuses));
  assert.equal(statuses[8], 429);
});

test("owner can delete a manual listing", async () => {
  const denied = await jsonRequest(`/api/properties/${listingId}`, { method: "DELETE", userId: IDS.other });
  assert.equal(denied.status, 403);

  const [buyerProfile] = await db.insert(buyerProfiles).values({
    userId: IDS.other,
    displayName: "Deletion integrity buyer",
    preApprovalAmount: 900000,
  }).returning();
  const [conversation] = await db.insert(conversations).values({
    propertyId: listingId,
    buyerUserId: IDS.other,
    agentUserId: IDS.owner,
  }).returning();
  await db.insert(messages).values({
    conversationId: conversation.id,
    senderUserId: IDS.other,
    content: "Can I see this listing?",
  });
  await db.insert(showingRequests).values({
    conversationId: conversation.id,
    propertyId: listingId,
    buyerUserId: IDS.other,
    agentUserId: IDS.owner,
    requestedDates: ["2026-09-10T18:00:00.000Z"],
  });
  await db.insert(buyerInterest).values({
    propertyId: listingId,
    buyerUserId: IDS.other,
    assignedAgentUserId: IDS.owner,
    listingAgentUserId: IDS.owner,
    conversationId: conversation.id,
  });
  await db.insert(buyerMatches).values({
    buyerProfileId: buyerProfile.id,
    propertyId: listingId,
    senderId: IDS.owner,
    conversationId: conversation.id,
  });
  const [offer] = await db.insert(propertyOffers).values({
    propertyId: listingId,
    buyerUserId: IDS.other,
    listingAgentId: IDS.owner,
    buyerAgentId: IDS.owner,
    conversationId: conversation.id,
  }).returning();
  await Promise.all([
    db.insert(savedProperties).values({ userId: IDS.other, propertyId: listingId }),
    db.insert(swipeNotifications).values({
      buyerUserId: IDS.other,
      propertyId: listingId,
      notifiedParty: "listing_agent",
      notifiedUserId: IDS.owner,
      offerId: offer.id,
    }),
    db.insert(propertyReviews).values({
      propertyId: listingId,
      userId: IDS.other,
      rating: 5,
      comment: "Great listing",
    }),
    db.insert(sellerConcessions).values({
      propertyId: listingId,
      postedByUserId: IDS.owner,
      postedByRole: "agent",
      headline: "Closing credit",
    }),
    db.insert(notifications).values({
      userId: IDS.owner,
      type: "listing_activity",
      title: "Listing activity",
      message: "A buyer interacted with your listing",
      propertyId: listingId,
    }),
    db.insert(priceDropNotificationDeliveries).values({
      userId: IDS.other,
      propertyId: listingId,
      oldPrice: 1_300_000,
      newPrice: 1_250_000,
      eventKey: `listing-delete-${listingId}`,
    }),
  ]);

  const deleted = await jsonRequest(`/api/properties/${listingId}`, { method: "DELETE", userId: IDS.owner });
  assert.equal(deleted.status, 204);
  const missing = await jsonRequest(`/api/properties/${listingId}`);
  assert.equal(missing.status, 404);
  const [orphanNotifications, orphanDeliveries] = await Promise.all([
    db.select({ id: notifications.id }).from(notifications).where(eq(notifications.propertyId, listingId)),
    db.select({ id: priceDropNotificationDeliveries.id }).from(priceDropNotificationDeliveries).where(eq(priceDropNotificationDeliveries.propertyId, listingId)),
  ]);
  assert.equal(orphanNotifications.length, 0);
  assert.equal(orphanDeliveries.length, 0);
  await db.delete(buyerProfiles).where(eq(buyerProfiles.id, buyerProfile.id));
  listingId = 0;
});