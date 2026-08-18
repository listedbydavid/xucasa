import { Router } from "express";
  import fs from "fs";
  import path from "path";
  import { safeUser } from "../utils/safeUser";
  import { storage, buyerProfileCompleteness, resolveBuyerAgent } from "../storage";
  import { resolveUserDestination } from "../shared/routing";
  import { authStorage } from "../replit_integrations/auth/storage";
  import { db } from "../db";
  import { buyerMatches, buyerProfiles, sellLeads, users, savedProperties, savedSearches, searchHistory, userHomes, favoriteLists, sellerPitches, properties, clientAgentLinks, propertyOffers, swipeNotifications, propertyReviews, errorReports, notifications, buyerInterest, sellerConcessions, insertSellerConcessionSchema } from "@workspace/db";
  import { eq, desc, sql, or, and, ilike, inArray, count } from "drizzle-orm";
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

  const ERROR_ARCHIVE_PATH = path.join(process.cwd(), "data", "error-archive.json");
  
const router = Router();

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
    res.json(mine.map(stripConfidentialFields));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get(api.properties.get.path, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
  
  const prop = await storage.getProperty(id);
  if (!prop) return res.status(404).json({ message: "Property not found" });
  
  res.status(200).json(stripConfidentialFields(prop));
});

router.post(api.properties.create.path, isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const input = api.properties.create.input.parse(req.body);
    const { normalisePropertyType } = await import("../idxSync");
    const propertyType = normalisePropertyType(input.propertyType) || input.propertyType;
    if (!propertyType) {
      return res.status(400).json({ message: "Property type is required", field: "propertyType" });
    }
    const prop = await storage.createProperty({ ...input, propertyType, agentId: user.sub });
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
    
    const user = req.user.claims;
    if (prop.agentId !== user.sub) {
      return res.status(401).json({ message: "Unauthorized: You can only edit your own properties" });
    }

    const input = api.properties.update.input.parse(req.body);
    const updatedProp = await storage.updateProperty(id, input);
    res.status(200).json(updatedProp);

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
      return res.status(401).json({ message: "Unauthorized: You can only delete your own properties" });
    }

    await storage.deleteProperty(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/properties/:id/similar", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });

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
    res.json(openHouses);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
