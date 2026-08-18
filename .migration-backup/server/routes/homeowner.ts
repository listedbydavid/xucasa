import { Router } from "express";
  import fs from "fs";
  import path from "path";
  import { storage, buyerProfileCompleteness, resolveBuyerAgent } from "../storage";
  import { resolveUserDestination } from "@shared/routing";
  import { authStorage } from "../replit_integrations/auth/storage";
  import { db } from "../db";
  import { buyerMatches, buyerProfiles, sellLeads, users, savedProperties, savedSearches, searchHistory, userHomes, favoriteLists, sellerPitches, properties, clientAgentLinks, propertyOffers, swipeNotifications, propertyReviews, errorReports, notifications, buyerInterest, sellerConcessions, insertSellerConcessionSchema } from "@shared/schema";
  import { eq, desc, sql, or, and, ilike, inArray, count } from "drizzle-orm";
  import { api } from "@shared/routes";
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

router.get("/api/home-report/geocode", async (req, res) => {
  try {
    const { streetNumber, streetName, city, state, zip } = req.query as Record<string, string>;
    if (!city || !state) {
      return res.status(200).json({ lat: null, lng: null });
    }
    const { geocodeAddress } = await import("../publicRecords");
    const result = await geocodeAddress(streetNumber || "", streetName || "", city, state, zip || "");
    if (result) {
      res.status(200).json({ lat: result.lat, lng: result.lng });
    } else {
      res.status(200).json({ lat: null, lng: null });
    }
  } catch (err) {
    console.error("Home report geocode error:", err);
    res.status(200).json({ lat: null, lng: null });
  }
});

router.get("/api/property-lookup", async (req, res) => {
  try {
    const { streetNumber, streetName, city, state, zip } = req.query as Record<string, string>;
    if (!streetName || !city) {
      return res.status(200).json({ found: false });
    }
    const conditions = [
      ilike(properties.addressCity, city.trim()),
    ];
    if (streetNumber) {
      conditions.push(eq(properties.addressStreetNumber, streetNumber.trim()));
    }
    if (streetName) {
      conditions.push(ilike(properties.addressStreetName, streetName.trim()));
    }
    if (state) {
      conditions.push(eq(properties.addressState, state.trim()));
    }
    if (zip) {
      conditions.push(eq(properties.addressZip, zip.trim()));
    }
    const [match] = await db.select({
      beds: properties.beds,
      baths: properties.baths,
      sqft: properties.sqft,
      lotSize: properties.lotSize,
      propertyType: properties.propertyType,
      hoaFee: properties.hoaFee,
      id: properties.id,
      title: properties.title,
      price: properties.price,
      imageUrl: properties.imageUrl,
    }).from(properties).where(and(...conditions)).limit(1);
    if (match) {
      res.json({
        found: true,
        beds: match.beds,
        baths: match.baths ? parseFloat(match.baths) : null,
        sqft: match.sqft,
        lotSize: match.lotSize,
        propertyType: match.propertyType,
        hoaFee: match.hoaFee,
        id: match.id,
        title: match.title,
        price: match.price,
        imageUrl: match.imageUrl,
      });
    } else {
      res.json({ found: false });
    }
  } catch (err) {
    console.error("Property lookup error:", err);
    res.status(200).json({ found: false });
  }
});

router.get("/api/home-report/public-records", async (req, res) => {
  try {
    const { streetNumber, streetName, city, state, zip } = req.query as Record<string, string>;
    if (!city || !state) {
      return res.status(200).json({ neighborhoodStats: null, floodInfo: null, nearbyPlaces: null });
    }
    const records = await getPublicRecords(streetNumber || "", streetName || "", city, state, zip || "");
    const result: any = { neighborhoodStats: null, floodInfo: null, nearbyPlaces: null };
    if (records.neighborhood) {
      result.neighborhoodStats = {
        medianIncome: records.neighborhood.medianHouseholdIncome,
        medianHomeValue: records.neighborhood.medianHomeValue,
        totalPopulation: records.neighborhood.totalPopulation,
        ownerOccupiedPct: records.neighborhood.ownerOccupiedPct,
      };
    }
    if (records.flood) {
      result.floodInfo = {
        zone: records.flood.floodZone,
        sfha: records.flood.sfha,
        description: records.flood.description,
      };
    }
    if (records.nearby) {
      result.nearbyPlaces = records.nearby;
    }
    res.status(200).json(result);
  } catch (err) {
    console.error("Home report public records error:", err);
    res.status(500).json({ message: "Failed to fetch public records" });
  }
});

router.get("/api/home-report/zoning", async (req, res) => {
  try {
    const { streetNumber, streetName, city, state, zip, lat, lng } = req.query as Record<string, string>;
    if (!lat || !lng) {
      return res.status(200).json({ landUse: null, buildingContext: null, elevation: null, developmentActivity: null });
    }
    const data = await getZoningData(
      streetNumber || "", streetName || "", city || "", state || "", zip || "",
      parseFloat(lat), parseFloat(lng)
    );
    const result: any = {
      landUse: data.landUse || null,
      buildingContext: data.buildingContext ? {
        typicalLevels: data.buildingContext.typicalLevels,
        maxLevels: data.buildingContext.maxLevels,
        buildings: data.buildingContext.sampleBuildings || [],
      } : null,
      elevation: data.elevation || null,
      developmentActivity: {
        construction: data.activeConstruction || [],
        historic: data.historicDesignations || [],
      },
    };
    res.status(200).json(result);
  } catch (err) {
    console.error("Home report zoning error:", err);
    res.status(500).json({ message: "Failed to fetch zoning data" });
  }
});

router.get("/api/my-homes", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const homes = await storage.getUserHomes(userId);
    res.status(200).json(homes);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/my-homes", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const homeSchema = z.object({
      nickname: z.string().min(1).max(200),
      addressStreetNumber: z.string().max(50).optional(),
      addressStreetName: z.string().max(200).optional(),
      addressUnitNumber: z.string().max(50).optional(),
      addressCity: z.string().max(100).optional(),
      addressState: z.string().max(50).optional(),
      addressZip: z.string().max(20).optional(),
      notes: z.string().max(5000).optional(),
      beds: z.number().int().min(0).max(100).optional(),
      baths: z.union([z.number(), z.string()]).optional(),
      sqft: z.number().int().optional(),
      lotSize: z.number().optional(),
      yearBuilt: z.number().int().optional(),
      homeType: z.string().max(100).optional(),
      purchasePrice: z.number().optional(),
      purchaseDate: z.string().optional(),
      principalBalance: z.number().optional(),
      appraisedValue: z.number().optional(),
      interestRate: z.union([z.number(), z.string()]).optional(),
      loanTerm: z.number().int().optional(),
      monthlyPayment: z.number().optional(),
      loanType: z.string().max(100).optional(),
      estimatedValue: z.number().optional(),
    });
    const parsedHome = homeSchema.safeParse(req.body);
    if (!parsedHome.success) return res.status(400).json({ message: "nickname required", errors: parsedHome.error.flatten() });
    const {
      nickname, addressStreetNumber, addressStreetName, addressUnitNumber,
      addressCity, addressState, addressZip, notes,
      beds, baths, sqft, lotSize, yearBuilt, homeType,
      purchasePrice, purchaseDate, principalBalance, appraisedValue,
      interestRate, loanTerm, monthlyPayment, loanType, estimatedValue,
    } = parsedHome.data;

    const home = await storage.createUserHome(userId, {
      nickname, addressStreetNumber, addressStreetName, addressUnitNumber,
      addressCity, addressState, addressZip, notes,
      beds, baths: baths !== undefined ? String(baths) : undefined, sqft, lotSize, yearBuilt, homeType,
      purchasePrice, purchaseDate, principalBalance, appraisedValue,
      interestRate: interestRate !== undefined ? String(interestRate) : undefined,
      loanTerm, monthlyPayment, loanType, estimatedValue,
    });

    // Geocode in background
    (async () => {
      try {
        const { geocodeAddress } = await import("../publicRecords");
        const geo = await geocodeAddress(addressStreetNumber || "", addressStreetName || "", addressCity || "", addressState || "", addressZip || "");
        if (geo) {
          await storage.updateUserHome(home.id, userId, { lat: String(geo.lat), lng: String(geo.lng) } as any);
          // Generate Street View image URL
          const MAPS_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || "";
          if (MAPS_KEY) {
            const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${geo.lat},${geo.lng}&fov=90&pitch=5&key=${MAPS_KEY}`;
            await storage.updateUserHome(home.id, userId, { imageUrl: svUrl } as any);
          }
        }
      } catch { /* non-fatal */ }
    })();

    res.status(201).json(home);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/api/my-homes/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const homePatchSchema = z.object({
      nickname: z.string().max(200).optional(),
      addressStreetNumber: z.string().max(50).optional(),
      addressStreetName: z.string().max(200).optional(),
      addressUnitNumber: z.string().max(50).optional(),
      addressCity: z.string().max(100).optional(),
      addressState: z.string().max(50).optional(),
      addressZip: z.string().max(20).optional(),
      notes: z.string().max(5000).optional(),
      imageUrl: z.string().max(2000).optional(),
      beds: z.number().int().min(0).max(100).optional(),
      baths: z.union([z.number(), z.string()]).optional(),
      sqft: z.number().int().optional(),
      lotSize: z.number().optional(),
      yearBuilt: z.number().int().optional(),
      homeType: z.string().max(100).optional(),
      purchasePrice: z.number().optional(),
      purchaseDate: z.string().optional(),
      principalBalance: z.number().optional(),
      appraisedValue: z.number().optional(),
      interestRate: z.union([z.number(), z.string()]).optional(),
      loanTerm: z.number().int().optional(),
      monthlyPayment: z.number().optional(),
      loanType: z.string().max(100).optional(),
      estimatedValue: z.number().optional(),
    });
    const parsedHomePatch = homePatchSchema.safeParse(req.body);
    if (!parsedHomePatch.success) return res.status(400).json({ message: "Invalid request", errors: parsedHomePatch.error.flatten() });
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsedHomePatch.data)) {
      if (v === undefined) continue;
      if ((k === "baths" || k === "interestRate") && typeof v === "number") {
        updates[k] = String(v);
      } else {
        updates[k] = v;
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updated = await storage.updateUserHome(id, userId, updates as any);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/api/my-homes/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteUserHome(id, userId);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/my-homes/:id/intelligence", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const homes = await storage.getUserHomes(userId);
    const home = homes.find(h => h.id === id);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const streetNumber = home.addressStreetNumber || "";
    const streetName = home.addressStreetName || "";
    const city = home.addressCity || "";
    const state = home.addressState || "";
    const zip = home.addressZip || "";

    const { geocodeAddress, getPublicRecords: fetchPublicRecords } = await import("../publicRecords");
    const { getZoningData } = await import("../zoningData");

    const [geocoded, publicRecords] = await Promise.all([
      geocodeAddress(streetNumber, streetName, city, state, zip),
      fetchPublicRecords(streetNumber, streetName, city, state, zip),
    ]);

    let zoning = null;
    if (geocoded) {
      zoning = await getZoningData(streetNumber, streetName, city, state, zip, geocoded.lat, geocoded.lng);
    }

    res.status(200).json({ publicRecords, zoning, geocoded });
  } catch (err) {
    console.error("My home intelligence error:", err);
    res.status(500).json({ message: "Failed to fetch home data" });
  }
});

router.get("/api/valuation", async (req, res) => {
  try {
    const beds = parseInt(req.query.beds as string) || 3;
    const sqft = parseInt(req.query.sqft as string) || 1800;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const valuation = await storage.getValuation(beds, sqft, lat, lng);
    res.json(valuation);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/sell-leads", async (req, res) => {
  try {
    const sellLeadSchema = z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(200),
      phone: z.string().max(30).optional(),
      address: z.string().max(500).optional(),
      beds: z.number().optional(),
      baths: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional(),
      sqft: z.number().optional(),
      lotSize: z.number().optional(),
      yearBuilt: z.number().optional(),
      homeType: z.string().max(100).optional(),
      condition: z.string().max(100).optional(),
      hoaFee: z.number().optional(),
      timeline: z.string().max(100).optional(),
      motivation: z.string().max(100).optional(),
      needsToBuyNext: z.boolean().optional(),
      hasAgent: z.boolean().optional(),
      sellerAgentEmail: z.string().email().max(200).optional().nullable(),
      listingType: z.string().max(50).optional(),
      lat: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional().nullable(),
      lng: z.union([z.number(), z.string().transform(v => parseFloat(v))]).optional().nullable(),
    });
    const parsed = sellLeadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const lead: any = parsed.data;

    lead.needsLenderReferral = lead.needsToBuyNext === true;
    lead.needsAgentReferral = lead.hasAgent === false;

    let agentLinked = false;
    if (lead.hasAgent && lead.sellerAgentEmail) {
      const agentUser = await db.select().from(users)
        .where(eq(users.email, lead.sellerAgentEmail.trim().toLowerCase()))
        .limit(1);
      if (agentUser.length > 0) {
        lead.agentId = agentUser[0].id;
        agentLinked = true;
      }
    }

    const newLead = await storage.createSellLead(lead);
    await audit({ req, event: "sell_lead_created", outcome: "success", metadata: { email: lead.email, address: lead.address } });
    res.status(201).json({ ...newLead, agentLinked });
  } catch (err: any) {
    await audit({ req, event: "sell_lead_created", outcome: "failure", errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/my-homes/:id/match-property", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const homeId = parseInt(req.params.id);
    if (!Number.isFinite(homeId)) return res.status(400).json({ message: "Invalid id" });
    const homes = await db.select().from(userHomes)
      .where(and(eq(userHomes.id, homeId), eq(userHomes.userId, userId)))
      .limit(1);
    const home = homes[0];
    if (!home) return res.status(404).json({ message: "Home not found" });
    if (!home.addressStreetNumber || !home.addressStreetName || !home.addressZip) {
      return res.json({ propertyId: null });
    }
    const matches = await db.select({ id: properties.id }).from(properties)
      .where(and(
        sql`lower(coalesce(${properties.addressStreetNumber}, '')) = lower(${home.addressStreetNumber})`,
        sql`lower(coalesce(${properties.addressStreetName}, '')) = lower(${home.addressStreetName})`,
        sql`coalesce(${properties.addressZip}, '') = ${home.addressZip}`,
      ))
      .limit(1);
    res.json({ propertyId: matches[0]?.id || null });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
