import { Router } from "express";
  import { randomUUID } from "crypto";
  import multer from "multer";
  import sharp from "sharp";
  import { rateLimit } from "express-rate-limit";
  import fs from "fs";
  import path from "path";
  import { safeUser } from "../utils/safeUser";
  import { DAVID_USER_ID, storage, buyerProfileCompleteness, resolveBuyerAgent } from "../storage";
  import { resolveUserDestination } from "../shared/routing";
  import { authStorage } from "../replit_integrations/auth/storage";
  import { db } from "../db";
  import { buyerMatches, buyerProfiles, sellLeads, users, savedProperties, savedSearches, searchHistory, userHomes, favoriteLists, sellerPitches, properties, clientAgentLinks, propertyOffers, swipeNotifications, propertyReviews, errorReports, notifications, buyerInterest, sellerConcessions, insertSellerConcessionSchema, propertyAnalytics, propertyInquiries } from "@workspace/db";
  import { eq, desc, sql, or, and, ilike, inArray, count, gt } from "drizzle-orm";
  import { api } from "../shared/routes";
  import { z } from "zod";
  import { isAuthenticated } from "../replit_integrations/auth";
  import { getPublicRecords } from "../publicRecords";
  import { getNearbySchools } from "../schoolService";
  import { getZoningData } from "../zoningData";
  import { runIdxSync, isSyncInProgress, idxConfigured, getLastSyncLog, getSyncLogs, startIdxAutoSync, backfillRentalReclassification, verifyAgentLicense, getRealtyFeedToken, realtyFeedODataFetch, REALTYFEED_API_BASE } from "../idxSync";
  import { sendNotificationEmail, sendTestEmail, isEmailConfigured } from "../emailService";
  import { onboardingRateLimit, isAdmin } from "../authMiddleware";
  import { listSuspiciousAccounts, disableAccount, deleteAccountSafely, bulkDisable, bulkDelete } from "../cleanupService";
  import { audit, executeWithAudit } from "../auditLog";
  import { logger } from "../logger";
  import { stripConfidentialFields, CONFIDENTIAL_MLS_FIELDS } from "../lib/mlsHelpers";
  import { runAgentVerificationFlow } from "../lib/agentVerification";
  import { notifySavedPropertyPriceDrops } from "../lib/priceDropNotifications";
  import { deleteListingPhoto, getListingPhoto, uploadListingPhoto } from "../lib/listingPhotoStorage";
  import { hasListingShareAccess, isPrivateListing } from "../lib/listingShareAccess";
  import { isDraftProperty } from "../lib/propertyVisibility";

  const ERROR_ARCHIVE_PATH = path.join(process.cwd(), "data", "error-archive.json");
  
const router = Router();

const listingStatuses = ["draft", "active", "coming_soon", "pre_market", "off_market", "pending", "sold", "archived"] as const;
const listingStatusSchema = z.enum(listingStatuses);
const manualListingStatuses = new Set(["draft", "active", "coming_soon", "pre_market", "off_market", "pending"]);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const listingInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(10_000).optional().default(""),
  price: z.coerce.number().int().min(0).max(2_000_000_000),
  addressStreetNumber: optionalText(30),
  addressStreetName: optionalText(160),
  addressUnitNumber: optionalText(50),
  addressCity: z.string().trim().min(1).max(100),
  addressState: z.string().trim().min(2).max(30),
  addressCounty: optionalText(100),
  addressZip: optionalText(20),
  location: optionalText(220),
  beds: z.coerce.number().int().min(0).max(100).optional().default(0),
  baths: z.coerce.number().min(0).max(100).optional().default(0),
  sqft: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
  lotSize: z.coerce.number().int().min(0).nullable().optional(),
  hoaFee: z.coerce.number().int().min(0).nullable().optional(),
  propertyType: optionalText(100),
  listingStatus: listingStatusSchema.optional(),
  status: listingStatusSchema.optional(),
  expectedMlsNumber: optionalText(100),
  expectedListDate: optionalText(40),
  preMarketNotes: optionalText(5_000),
  yearBuilt: z.coerce.number().int().min(1700).max(2200).nullable().optional(),
  conditionNotes: optionalText(5_000),
  investorNotes: optionalText(10_000),
  arv: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
  estimatedRepairCost: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
  imageUrl: optionalText(2_000),
  photos: z.array(z.string().max(2_000)).max(20).optional(),
  isOffMarket: z.boolean().optional(),
  lat: z.union([z.string(), z.number()]).nullable().optional(),
  lng: z.union([z.string(), z.number()]).nullable().optional(),
  openHouseDate: z.string().trim().max(40).nullable().optional(),
  openHouseTime: optionalText(100),
  listDate: z.string().trim().max(40).nullable().optional(),
  virtualTourUrl: optionalText(2_000),
  confidentialRemarks: optionalText(10_000),
  showingInstructions: optionalText(5_000),
  accessInstructions: optionalText(5_000),
  source: z.enum(["manual", "coming_soon", "pre_market", "off_market"]).optional(),
}).strict();

const listingUpdateSchema = listingInputSchema.partial();
const inquiryInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(5).max(320),
  message: z.string().trim().max(2_000).nullable().optional(),
  source: z.string().trim().max(100).optional().default("listing_inquiry"),
}).strict();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 20, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const accepted = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    const isAccepted = accepted.has(file.mimetype);
    if (!isAccepted) return callback(new Error("Unsupported image type"));
    callback(null, true);
  },
}).array("photos", 20);

const inquiryRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many inquiries. Please try again later." },
});

function normaliseListingWrite(input: z.infer<typeof listingUpdateSchema>) {
  const requestedStatus = input.listingStatus ?? input.status;
  const updates: Record<string, unknown> = { ...input };
  delete updates.source;
  if (requestedStatus) {
    updates.listingStatus = requestedStatus;
    updates.status = requestedStatus;
  }
  updates.source = "manual";
  if (input.baths !== undefined) updates.baths = String(input.baths);
  if (input.lat !== undefined && input.lat !== null) updates.lat = String(input.lat);
  if (input.lng !== undefined && input.lng !== null) updates.lng = String(input.lng);
  if (input.openHouseDate !== undefined) {
    updates.openHouseDate = input.openHouseDate ? new Date(input.openHouseDate) : null;
  }
  if (input.listDate !== undefined) {
    updates.listDate = input.listDate ? new Date(input.listDate) : null;
  }
  return updates;
}

async function requireListingOwner(propertyId: number, userId: string) {
  const [property, agent] = await Promise.all([
    storage.getProperty(propertyId),
    authStorage.getUser(userId),
  ]);
  if (
    !property
    || property.agentId !== userId
    || property.source !== "manual"
    || agent?.role !== "agent"
    || agent.agentVerified !== true
  ) return null;
  return property;
}

function withoutServerOwnedAgentFields(body: unknown): Record<string, unknown> {
  const payload = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};
  delete payload.agentId;
  delete payload.agentPhone;
  delete payload.agentEmail;
  return payload;
}

const soldCache = new Map<string, { data: any[]; ts: number }>();
const SOLD_CACHE_TTL = 30 * 60 * 1000;

async function geocodeAndPatch(id: number, streetNumber: string, streetName: string, city: string, state: string, zip: string) {
  try {
    const { geocodeAddress } = await import("../publicRecords");
    const geocoded = await geocodeAddress(streetNumber, streetName, city, state, zip);
    if (geocoded) {
      await storage.updateProperty(id, { lat: String(geocoded.lat), lng: String(geocoded.lng) } as any);
    }
  } catch { /* non-fatal */ }
}

router.get(api.properties.list.path, async (req, res) => {
  try {
    const filters = api.properties.list.input?.parse(req.query);
    const effectiveLimit = Math.min(Math.max(filters?.limit || 50, 1), 200);
    const effectiveOffset = Math.max(filters?.offset || 0, 0);
    const normalizedFilters = { ...filters, limit: effectiveLimit, offset: effectiveOffset };
    const [props, total] = await Promise.all([
      storage.getProperties(normalizedFilters),
      storage.getPropertiesCount(normalizedFilters),
    ]);
    res.status(200).json({ properties: props.map(stripConfidentialFields), total, limit: effectiveLimit, offset: effectiveOffset });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/properties/autocomplete", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";
    const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);
    const results = await storage.autocompleteProperties(query, limit);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/locations/autocomplete", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

    const [cities, counties] = await Promise.all([
      storage.autocompleteCities(query, limit),
      storage.autocompleteCounties(query, 5),
    ]);

    const suggestions: { type: string; label: string; value: string; state: string; count: number }[] = [];

    for (const co of counties) {
      suggestions.push({
        type: "county",
        label: `${co.county} County, ${co.state}`,
        value: co.county,
        state: co.state,
        count: co.count,
      });
    }

    for (const c of cities) {
      suggestions.push({
        type: "city",
        label: `${c.city}, ${c.state}`,
        value: c.city,
        state: c.state,
        count: c.count,
      });
    }

    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/properties/mine", isAuthenticated, async (req, res) => {
  try {
    const mine = await storage.getPropertiesByAgent(req.user!.claims.sub);
    res.json(mine);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get(api.properties.get.path, async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
  
  const prop = await storage.getProperty(id);
  if (!prop) return res.status(404).json({ message: "Property not found" });
  if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });
  const viewerId = req.user?.claims?.sub;
  const isOwner = !!viewerId && prop.agentId === viewerId;
  if (isPrivateListing(prop)) res.set("X-Robots-Tag", "noindex, nofollow");

  // Persist verified referring agent from ?agent= query param into the session.
  // This is used by GET /api/properties/:id/contact-agent to show the referring
  // agent for unrepresented visitors. We only persist a verified agent.
  const agentParam = req.query?.agent;
  if (agentParam && typeof agentParam === "string" && agentParam.trim() && req.session) {
    try {
      const { authStorage: aStorage } = await import("../replit_integrations/auth/storage");
      const referringAgent = await aStorage.getUser(agentParam.trim());
      if (referringAgent && referringAgent.agentVerified && referringAgent.role === "agent") {
        req.session.referringAgentId = referringAgent.id;
        req.session.referredPropertyId = id;
      }
    } catch {
      // non-fatal — just skip referral storage
    }
  }
  
  res.status(200).json(isOwner ? prop : stripConfidentialFields(prop));
});

router.post(api.properties.create.path, isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const agent = await storage.getUser(userId);
    if (!agent || agent.role !== "agent" || !agent.agentVerified) {
      return res.status(403).json({ message: "A verified agent account is required to create listings" });
    }

    const input = listingInputSchema.parse(withoutServerOwnedAgentFields(req.body));
    const { normalisePropertyType } = await import("../idxSync");
    const propertyType = normalisePropertyType(input.propertyType) || input.propertyType;
    if (!propertyType) {
      return res.status(400).json({ message: "Property type is required", field: "propertyType" });
    }
    const listingStatus = input.listingStatus
      ?? input.status
      ?? "draft";
    if (!manualListingStatuses.has(listingStatus)) {
      return res.status(400).json({ message: "Invalid listing status", field: "status" });
    }
    const location = input.location
      || [input.addressCity, input.addressState].filter(Boolean).join(", ");
    const normalized = normaliseListingWrite({ ...input, listingStatus });
    const prop = await storage.createProperty({
      ...normalized,
      title: input.title,
      description: input.description,
      price: input.price,
      location,
      beds: input.beds,
      baths: String(input.baths),
      sqft: input.sqft,
      propertyType,
      agentId: userId,
      agentPhone: agent.phone ?? null,
      agentEmail: agent.email ?? null,
      listingAgentName: `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || "Listing Agent",
      listingAgentEmail: agent.email ?? null,
      listingAgentPhone: agent.phone ?? null,
      listingBrokerage: agent.brokerageName ?? null,
      listingAgentLicenseNumber: agent.licenseNumber ?? null,
      listingStatus,
      status: listingStatus,
      source: "manual",
      photos: [],
      isOffMarket: input.isOffMarket ?? false,
      listDate: normalized.listDate ?? (listingStatus === "draft" ? null : new Date()),
    } as any);
    res.status(201).json(prop);

    // Geocode in background after response is sent
    const city = input.addressCity || input.location?.split(",")[0]?.trim() || "";
    const state = (input.addressState || input.location?.split(",")[1]?.trim() || "").trim();
    if (city && state) {
      geocodeAndPatch(prop.id, input.addressStreetNumber || "", input.addressStreetName || "", city, state, input.addressZip || "");
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
    } else {
      logger.error({
        event: "manual_listing_create_failed",
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

router.put(api.properties.update.path, isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    
    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    
    const userId = req.user.claims.sub;
    if (prop.agentId !== userId) {
      return res.status(403).json({ message: "You can only edit your own properties" });
    }
    const agent = await authStorage.getUser(userId);
    if (!agent || agent.role !== "agent" || agent.agentVerified !== true) {
      return res.status(403).json({ message: "Verified agent access required" });
    }
    if (prop.source !== "manual") {
      return res.status(403).json({ message: "MLS listings are managed by the IDX feed" });
    }

    const input = listingUpdateSchema.parse(withoutServerOwnedAgentFields(req.body));
    const requestedStatus = input.listingStatus ?? input.status;
    if (requestedStatus && !manualListingStatuses.has(requestedStatus)) {
      return res.status(400).json({
        message: requestedStatus === "archived"
          ? "Use the archive action to archive a listing"
          : "Invalid listing status",
        field: "status",
      });
    }
    const priceChanged = typeof input.price === "number" && input.price !== prop.price;
    const updatedProp = await storage.updateProperty(id, {
      ...normaliseListingWrite(input),
      ...(prop.status === "draft" && requestedStatus && requestedStatus !== "draft" && !prop.listDate
        ? { listDate: new Date() }
        : {}),
      ...(priceChanged ? { priceUpdatedAt: new Date() } : {}),
    } as any);
    res.status(200).json(updatedProp);

    if (typeof input.price === "number" && input.price > 0 && input.price < prop.price) {
      void notifySavedPropertyPriceDrops([
        {
          id,
          oldPrice: prop.price,
          newPrice: input.price,
          eventKey: `${prop.price}:${input.price}:${prop.priceUpdatedAt?.toISOString?.() ?? "manual"}`,
        },
      ]).catch(error => {
        logger.error({
          event: "manual_price_drop_notifications_failed",
          error: error instanceof Error ? error.message : String(error),
          propertyId: id,
        });
      });
    }

    // Re-geocode if address changed
    const merged = { ...prop, ...input };
    const city = merged.addressCity || merged.location?.split(",")[0]?.trim() || "";
    const state = (merged.addressState || merged.location?.split(",")[1]?.trim() || "").trim();
    if (city && state) {
      geocodeAndPatch(id, merged.addressStreetNumber || "", merged.addressStreetName || "", city, state, merged.addressZip || "");
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
    } else {
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

router.delete(api.properties.delete.path, isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    
    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    
    const user = req.user.claims;
    if (prop.agentId !== user.sub) {
      return res.status(403).json({ message: "You can only delete your own properties" });
    }
    const agent = await authStorage.getUser(user.sub);
    if (!agent || agent.role !== "agent" || agent.agentVerified !== true) {
      return res.status(403).json({ message: "Verified agent access required" });
    }
    if (prop.source !== "manual") {
      return res.status(403).json({ message: "MLS listings are managed by the IDX feed" });
    }

    await storage.deleteProperty(id);
    const photoPrefix = `/api/listing-photos/${id}/`;
    const photoResults = await Promise.allSettled(
      (prop.photos || [])
        .filter(photoUrl => photoUrl.startsWith(photoPrefix))
        .map(photoUrl => deleteListingPhoto(id, photoUrl.slice(photoPrefix.length))),
    );
    const failedPhotos = photoResults.filter(result => result.status === "rejected").length;
    if (failedPhotos > 0) {
      logger.warn({ event: "listing_photo_cleanup_incomplete", propertyId: id, failedPhotos });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/listing-photos/:propertyId/:fileName", async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    if (!Number.isInteger(propertyId)) return res.status(400).json({ message: "Invalid property ID" });
    const property = await storage.getProperty(propertyId);
    if (!property || !hasListingShareAccess(req, property)) {
      return res.status(404).json({ message: "Photo not found" });
    }
    const file = await getListingPhoto(propertyId, req.params.fileName);
    if (!file) return res.status(404).json({ message: "Photo not found" });
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "image/webp");
    res.setHeader(
      "Cache-Control",
      isPrivateListing(property) ? "private, no-store" : "public, max-age=31536000, immutable",
    );
    file.createReadStream()
      .on("error", () => {
        if (!res.headersSent) res.status(500).json({ message: "Unable to read photo" });
      })
      .pipe(res);
  } catch {
    res.status(404).json({ message: "Photo not found" });
  }
});

router.post("/api/properties/:id/photos", isAuthenticated, (req: any, res) => {
  photoUpload(req, res, async (uploadError: any) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message || "Photo upload failed" });
    }
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid property ID" });
      const property = await requireListingOwner(id, req.user.claims.sub);
      if (!property) return res.status(403).json({ message: "You can only add photos to your own listings" });

      const files = (req.files || []) as Express.Multer.File[];
      if (!files.length) return res.status(400).json({ message: "Select at least one photo" });
      const existingPhotos = property.photos || [];
      if (existingPhotos.length + files.length > 20) {
        return res.status(400).json({ message: "Listings can have at most 20 photos" });
      }

      const uploaded: Array<{ fileName: string; url: string }> = [];
      try {
        for (const file of files) {
          const optimized = await sharp(file.buffer)
            .rotate()
            .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
          const fileName = `${randomUUID()}.webp`;
          const url = await uploadListingPhoto(id, fileName, optimized);
          uploaded.push({ fileName, url });
        }
      } catch (error) {
        await Promise.all(uploaded.map(photo => deleteListingPhoto(id, photo.fileName)));
        throw error;
      }

      const photos = [...existingPhotos, ...uploaded.map(photo => photo.url)];
      const updated = await storage.updateProperty(id, {
        photos,
        imageUrl: property.imageUrl || photos[0] || null,
      } as any);
      res.status(201).json({ photos: updated.photos, imageUrl: updated.imageUrl });
    } catch (error) {
      logger.error({
        event: "listing_photo_upload_failed",
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Photo upload failed" });
    }
  });
});

router.delete("/api/properties/:id/photos", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({
      photoUrl: z.string().min(1).optional(),
      url: z.string().min(1).optional(),
    }).strict().refine(value => !!(value.photoUrl || value.url), {
      message: "Photo URL is required",
    }).parse(req.body);
    const property = await requireListingOwner(id, req.user.claims.sub);
    if (!property) return res.status(403).json({ message: "You can only remove photos from your own listings" });
    const photoUrl = body.photoUrl || body.url!;
    const expectedPrefix = `/api/listing-photos/${id}/`;
    if (!photoUrl.startsWith(expectedPrefix) || !(property.photos || []).includes(photoUrl)) {
      return res.status(400).json({ message: "Photo does not belong to this listing" });
    }
    const fileName = photoUrl.slice(expectedPrefix.length);
    const photos = (property.photos || []).filter(photo => photo !== photoUrl);
    const updated = await storage.updateProperty(id, {
      photos,
      imageUrl: property.imageUrl === photoUrl ? (photos[0] || null) : property.imageUrl,
    } as any);
    await deleteListingPhoto(id, fileName).catch(error => {
      logger.warn({
        event: "listing_photo_delete_incomplete",
        propertyId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    res.json({ photos: updated.photos, imageUrl: updated.imageUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Unable to remove photo" });
  }
});

router.post("/api/properties/:id/view", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const input = z.object({
      source: z.string().trim().max(100).optional().default("direct"),
      isMobile: z.boolean().optional().default(false),
    }).strict().parse(req.body || {});
    const property = await storage.getProperty(id);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, property)) return res.status(404).json({ message: "Property not found" });

    const viewerIp = req.ip || req.socket.remoteAddress || null;
    if (viewerIp) {
      const [recent] = await db.select({ id: propertyAnalytics.id })
        .from(propertyAnalytics)
        .where(and(
          eq(propertyAnalytics.propertyId, id),
          eq(propertyAnalytics.viewerIp, viewerIp),
          gt(propertyAnalytics.viewedAt, new Date(Date.now() - 60 * 60 * 1000)),
        ))
        .limit(1);
      if (recent) return res.json({ tracked: false, reason: "rate_limited" });
    }

    const referringAgentId = req.session?.referredPropertyId === id
      ? req.session.referringAgentId || null
      : null;
    void db.insert(propertyAnalytics).values({
      propertyId: id,
      viewerUserId: req.user?.claims?.sub || null,
      viewerIp,
      referringAgentId,
      source: input.source,
      userAgent: req.get("user-agent") || null,
      isMobile: input.isMobile,
    }).catch(error => {
      logger.error({
        event: "property_view_tracking_failed",
        error: error instanceof Error ? error.message : String(error),
        propertyId: id,
      });
    });
    res.json({ tracked: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Unable to track property view" });
  }
});

router.post("/api/properties/:id/inquiry", inquiryRateLimit, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const input = inquiryInputSchema.parse(req.body);
    const property = await storage.getProperty(id);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, property)) return res.status(404).json({ message: "Property not found" });
    if (isDraftProperty(property)) return res.status(404).json({ message: "Property not found" });

    let agentId: string | null = null;
    const buyerId = req.user?.claims?.sub;
    if (buyerId) {
      const buyer = await storage.getUser(buyerId);
      if (buyer?.assignedAgentUserId && buyer.assignedAgentUserId !== DAVID_USER_ID) {
        agentId = buyer.assignedAgentUserId;
      }
    }
    if (!agentId && req.session?.referredPropertyId === id && req.session.referringAgentId) {
      const referringAgent = await storage.getUser(req.session.referringAgentId);
      if (referringAgent?.agentVerified && referringAgent.role === "agent") {
        agentId = referringAgent.id;
      }
    }
    agentId = agentId || property.agentId || DAVID_USER_ID;

    const [inquiry] = await db.insert(propertyInquiries).values({
      propertyId: id,
      agentId,
      name: input.name,
      contact: input.contact,
      message: input.message || null,
      source: input.source,
    }).returning();

    await storage.createNotification({
      userId: agentId,
      type: "property_inquiry",
      title: `New inquiry for ${property.title}`,
      message: `${input.name} asked about ${property.location}`,
      propertyId: id,
      linkUrl: `/property/${id}`,
      read: false,
      archived: false,
      metadata: { inquiryId: inquiry.id, source: input.source },
    } as any);
    void audit({
      req,
      event: "property_inquiry_created",
      outcome: "success",
      userId: buyerId || null,
      propertyId: id,
      resourceType: "property",
      resourceId: String(id),
      metadata: { inquiryId: inquiry.id, agentId, source: input.source },
    });
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({
      event: "property_inquiry_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to submit inquiry" });
  }
});

router.get("/api/agent/listing-analytics/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const property = await requireListingOwner(id, req.user.claims.sub);
    if (!property) return res.status(403).json({ message: "You can only view analytics for your own listings" });
    const [totals, inquiries, saves, byDay, bySource] = await Promise.all([
      db.select({
        views: count(),
        uniqueVisitors: sql<number>`count(distinct coalesce(${propertyAnalytics.viewerUserId}, ${propertyAnalytics.viewerIp}))`,
        mobileViews: sql<number>`count(*) filter (where ${propertyAnalytics.isMobile} = true)`,
      }).from(propertyAnalytics).where(eq(propertyAnalytics.propertyId, id)),
      db.select({ total: count() }).from(propertyInquiries).where(eq(propertyInquiries.propertyId, id)),
      db.select({ total: count() }).from(savedProperties).where(eq(savedProperties.propertyId, id)),
      db.select({
        date: sql<string>`to_char(date_trunc('day', ${propertyAnalytics.viewedAt}), 'YYYY-MM-DD')`,
        views: count(),
      }).from(propertyAnalytics).where(eq(propertyAnalytics.propertyId, id))
        .groupBy(sql`date_trunc('day', ${propertyAnalytics.viewedAt})`)
        .orderBy(sql`date_trunc('day', ${propertyAnalytics.viewedAt})`),
      db.select({ source: propertyAnalytics.source, views: count() })
        .from(propertyAnalytics)
        .where(eq(propertyAnalytics.propertyId, id))
        .groupBy(propertyAnalytics.source),
    ]);
    res.json({
      views: Number(totals[0]?.views || 0),
      uniqueVisitors: Number(totals[0]?.uniqueVisitors || 0),
      mobileViews: Number(totals[0]?.mobileViews || 0),
      inquiries: Number(inquiries[0]?.total || 0),
      saves: Number(saves[0]?.total || 0),
      byDay: byDay.map(row => ({ ...row, views: Number(row.views) })),
      bySource: bySource.map(row => ({ source: row.source, views: Number(row.views) })),
    });
  } catch {
    res.status(500).json({ message: "Unable to load listing analytics" });
  }
});

router.post("/api/properties/:id/archive", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({ reason: z.string().trim().min(2).max(500).optional() }).strict().parse(req.body || {});
    const property = await requireListingOwner(id, req.user.claims.sub);
    if (!property) return res.status(403).json({ message: "You can only archive your own listings" });
    const updated = await storage.updateProperty(id, {
      listingStatus: "archived",
      status: "archived",
      archivedAt: new Date(),
      archivedReason: body.reason || "Archived by listing owner",
    } as any);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
    res.status(500).json({ message: "Unable to archive listing" });
  }
});

router.get("/api/properties/:id/similar", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });

    if (!prop.lat || !prop.lng || !prop.price) return res.json([]);

    const lat = parseFloat(prop.lat as string);
    const lng = parseFloat(prop.lng as string);
    const priceLow = Math.round(prop.price * 0.7);
    const priceHigh = Math.round(prop.price * 1.3);

    const similar = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(
        sql`${properties.id} != ${id}
          AND ${properties.status} = 'active'
          AND ${properties.lat} IS NOT NULL
          AND ${properties.lng} IS NOT NULL
          AND ${properties.price} BETWEEN ${priceLow} AND ${priceHigh}
          AND (
            3959 * acos(
              cos(radians(${lat})) * cos(radians(CAST(${properties.lat} AS double precision)))
              * cos(radians(CAST(${properties.lng} AS double precision)) - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(CAST(${properties.lat} AS double precision)))
            )
          ) < 5`
      )
      .orderBy(sql`3959 * acos(
        cos(radians(${lat})) * cos(radians(CAST(${properties.lat} AS double precision)))
        * cos(radians(CAST(${properties.lng} AS double precision)) - radians(${lng}))
        + sin(radians(${lat})) * sin(radians(CAST(${properties.lat} AS double precision)))
      )`)
      .limit(8);

    const result = similar.map(r => ({ ...stripConfidentialFields(r.property), agent: r.agent ? safeUser(r.agent as any) : null }));
    res.json(result);
  } catch (err) {
    console.error("Similar properties error:", err);
    res.status(500).json({ message: "Failed to fetch similar properties" });
  }
});

router.get("/api/properties/:id/sold-nearby", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });

    if (!prop.lat || !prop.lng) return res.json([]);

    const lat = parseFloat(prop.lat as string);
    const lng = parseFloat(prop.lng as string);
    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;

    const cached = soldCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < SOLD_CACHE_TTL) {
      return res.json(cached.data);
    }

    if (!idxConfigured()) return res.json([]);

    const radiusKm = 0.8045;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString().split("T")[0];

    const filter = `StandardStatus eq 'Closed' and CloseDate ge ${dateStr} and geo.distance(Coordinates, POINT(${lng} ${lat})) lt ${radiusKm}km`;
    const selectFields = "ListingKey,ListingId,ListPrice,ClosePrice,CloseDate,ListDate,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,LivingArea,LotSizeSquareFeet,StreetNumber,StreetName,UnitNumber,City,StateOrProvince,PostalCode,Latitude,Longitude,PropertyType,PropertySubType";

    const token = await getRealtyFeedToken();
    const url = `${REALTYFEED_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$top=20&$select=${selectFields}&$orderby=CloseDate desc&$expand=Media`;
    const apiRes = await realtyFeedODataFetch(url, token);

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => "");
      console.error(`Sold nearby API error: ${apiRes.status} — ${errBody.slice(0, 500)}`);
      return res.json([]);
    }

    const body = await apiRes.json() as any;
    const listings = (body.value || []).map((raw: any) => {
      const bathsFull = parseInt(raw.BathroomsFull || raw.BathroomsTotalInteger || "0") || 0;
      const bathsHalf = parseInt(raw.BathroomsHalf || "0") || 0;
      const photo = raw.Media?.[0]?.MediaURL || null;
      return {
        mlsNumber: raw.ListingId || raw.ListingKey,
        address: `${raw.StreetNumber || ""} ${raw.StreetName || ""}${raw.UnitNumber ? ` #${raw.UnitNumber}` : ""}, ${raw.City || ""}`.trim(),
        city: raw.City || "",
        state: raw.StateOrProvince || "",
        zip: raw.PostalCode || "",
        listPrice: parseInt(raw.ListPrice || "0") || 0,
        closePrice: parseInt(raw.ClosePrice || "0") || 0,
        closeDate: raw.CloseDate || null,
        listDate: raw.ListDate || null,
        beds: parseInt(raw.BedroomsTotal || "0") || 0,
        baths: String(bathsFull + bathsHalf * 0.5),
        sqft: parseInt(raw.LivingArea || "0") || 0,
        lotSize: parseInt(raw.LotSizeSquareFeet || "0") || null,
        propertyType: raw.PropertySubType || raw.PropertyType || null,
        lat: raw.Latitude ? String(raw.Latitude) : null,
        lng: raw.Longitude ? String(raw.Longitude) : null,
        imageUrl: photo,
      };
    });

    soldCache.set(cacheKey, { data: listings, ts: Date.now() });
    res.json(listings);
  } catch (err) {
    console.error("Sold nearby error:", err);
    res.json([]);
  }
});

router.get("/api/recently-sold", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    const limitParam = parseInt(req.query.limit as string) || 9;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const radiusMiles = Math.min(Math.max(radius, 0.5), 25);
    const resultLimit = Math.min(Math.max(limitParam, 1), 20);

    const results = await db
      .select()
      .from(properties)
      .where(
        sql`${properties.lat} IS NOT NULL
          AND ${properties.lng} IS NOT NULL
          AND ${properties.price} IS NOT NULL
          AND ${properties.price} > 10000
          AND ${properties.imageUrl} IS NOT NULL
          AND LOWER(COALESCE(
            CASE WHEN ${properties.source} = 'idx' THEN ${properties.status} ELSE ${properties.listingStatus} END,
            ${properties.status},
            ''
          )) NOT IN ('draft', 'archived')
          AND (
            3959 * acos(
              cos(radians(${lat})) * cos(radians(CAST(${properties.lat} AS double precision)))
              * cos(radians(CAST(${properties.lng} AS double precision)) - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(CAST(${properties.lat} AS double precision)))
            )
          ) < ${radiusMiles}`
      )
      .orderBy(sql`3959 * acos(
        cos(radians(${lat})) * cos(radians(CAST(${properties.lat} AS double precision)))
        * cos(radians(CAST(${properties.lng} AS double precision)) - radians(${lng}))
        + sin(radians(${lat})) * sin(radians(CAST(${properties.lat} AS double precision)))
      )`)
      .limit(resultLimit);

    const nearby = results.map((p) => ({
      id: p.id,
      address: [p.addressStreetNumber, p.addressStreetName].filter(Boolean).join(" ") || p.location,
      city: p.addressCity || "",
      state: p.addressState || "",
      zip: p.addressZip || "",
      price: p.price,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      imageUrl: p.imageUrl || (p.photos && p.photos.length > 0 ? p.photos[0] : null),
      propertyType: p.propertyType,
      status: p.status,
    }));

    res.json(nearby);
  } catch (err) {
    console.error("Recently sold error:", err);
    res.status(500).json({ message: "Failed to fetch recently sold properties" });
  }
});

router.get("/api/properties/:id/public-records", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });

    const streetNumber = prop.addressStreetNumber || "";
    const streetName = prop.addressStreetName || "";
    const city = prop.addressCity || prop.location?.split(",")[0]?.trim() || "";
    const state = prop.addressState || prop.location?.split(",")[1]?.trim() || "";
    const zip = prop.addressZip || "";

    if (!city || !state) {
      return res.status(200).json({ geocoded: null, neighborhood: null, flood: null, nearby: { schools: [], parks: [], hospitals: [], transit: [], groceries: [] } });
    }

    const records = await getPublicRecords(streetNumber, streetName, city, state, zip);
    res.status(200).json(records);
  } catch (err) {
    console.error("Public records error:", err);
    res.status(500).json({ message: "Failed to fetch public records" });
  }
});

router.get("/api/properties/:id/schools", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });

    const lat = prop.lat ? parseFloat(prop.lat as string) : null;
    const lng = prop.lng ? parseFloat(prop.lng as string) : null;
    const city = prop.addressCity || prop.location?.split(",")[0]?.trim() || "San Diego";
    const state = prop.addressState || "CA";

    if (!lat || !lng) {
      return res.status(200).json({ schools: [], district: null });
    }

    const data = await getNearbySchools(lat, lng, city, state);
    res.status(200).json(data);
  } catch (err) {
    console.error("Schools API error:", err);
    res.status(500).json({ message: "Failed to fetch schools data" });
  }
});

router.get("/api/properties/:id/agent-mls", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user?.claims;
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const { authStorage } = await import("../replit_integrations/auth/storage");
    const dbUser = await authStorage.getUser(user.sub);
    if (!dbUser || dbUser.role !== "agent" || dbUser.agentVerified !== true) {
      return res.status(403).json({ message: "Verified agent access required" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });
    if (prop.source === "manual" && prop.agentId !== req.user.claims.sub) {
      return res.status(403).json({ message: "Confidential details are visible only to the listing owner" });
    }

    res.json({
      mlsNumber: prop.mlsNumber,
      confidentialRemarks: prop.confidentialRemarks,
      showingInstructions: prop.showingInstructions,
      showingContactName: prop.showingContactName,
      showingContactPhone: prop.showingContactPhone,
      lockboxType: prop.lockboxType,
      accessInstructions: prop.accessInstructions,
      listingAgentName: prop.listingAgentName,
      listingAgentEmail: prop.listingAgentEmail,
      listingAgentPhone: prop.listingAgentPhone,
      listingAgentMlsId: prop.listingAgentMlsId,
      listingAgentLicenseNumber: prop.listingAgentLicenseNumber,
      listingBrokerage: prop.listingBrokerage,
      listingOfficeMlsId: prop.listingOfficeMlsId,
      listingOfficePhone: prop.listingOfficePhone,
      coListingAgentName: prop.coListingAgentName,
      coListingAgentEmail: prop.coListingAgentEmail,
      coListingAgentPhone: prop.coListingAgentPhone,
      buyerAgentCommission: prop.buyerAgentCommission,
      specialConditions: prop.specialConditions,
      mlsDocuments: prop.mlsDocuments,
    });
  } catch (err) {
    console.error("Agent MLS data error:", err);
    res.status(500).json({ message: "Failed to fetch agent MLS data" });
  }
});

router.get("/api/properties/:id/zoning", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (!hasListingShareAccess(req, prop)) return res.status(404).json({ message: "Property not found" });

    const streetNumber = prop.addressStreetNumber || "";
    const streetName = prop.addressStreetName || "";
    const city = prop.addressCity || prop.location?.split(",")[0]?.trim() || "";
    const state = (prop.addressState || prop.location?.split(",")[1]?.trim() || "").trim();
    const zip = prop.addressZip || "";

    // We need geocoordinates — reuse the public records geocoder
    const { geocodeAddress } = await import("../publicRecords");
    const geocoded = await geocodeAddress(streetNumber, streetName, city, state, zip);

    if (!geocoded) {
      return res.status(200).json({
        landUse: null, buildingContext: { typicalLevels: null, maxLevels: null, sampleBuildings: [], dominantBuildingType: null },
        elevation: null, activeConstruction: [], historicDesignations: [], zappLink: null,
      });
    }

    const data = await getZoningData(streetNumber, streetName, city, state, zip, geocoded.lat, geocoded.lng);
    res.status(200).json(data);
  } catch (err) {
    console.error("Zoning data error:", err);
    res.status(500).json({ message: "Failed to fetch zoning data" });
  }
});

router.get("/api/open-houses", async (_req, res) => {
  try {
    const openHouses = await storage.getUpcomingOpenHouses();
    res.json(openHouses.map(stripConfidentialFields));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
