import type { Express } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { db } from "./db";
import { buyerMatches, buyerProfiles, sellLeads, users, savedProperties, savedSearches, searchHistory, userHomes, favoriteLists, sellerPitches, properties, clientAgentLinks, propertyOffers, swipeNotifications, propertyReviews, errorReports, notifications, buyerInterest } from "@shared/schema";
import { eq, desc, sql, or, and, ilike } from "drizzle-orm";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";
import { getPublicRecords } from "./publicRecords";
import { getNearbySchools } from "./schoolService";
import { getZoningData } from "./zoningData";
import { runIdxSync, isSyncInProgress, idxConfigured, getLastSyncLog, getSyncLogs, startIdxAutoSync, verifyAgentLicense, getRealtyFeedToken, realtyFeedODataFetch, REALTYFEED_API_BASE } from "./idxSync";
import { sendNotificationEmail, sendTestEmail, isEmailConfigured } from "./emailService";

const ERROR_ARCHIVE_PATH = path.join(process.cwd(), "data", "error-archive.json");

const CONFIDENTIAL_MLS_FIELDS = [
  'confidentialRemarks', 'showingInstructions', 'showingContactName', 'showingContactPhone',
  'lockboxType', 'accessInstructions', 'listingAgentMlsId', 'listingAgentLicenseNumber',
  'coListingAgentName', 'coListingAgentEmail', 'coListingAgentPhone',
  'listingOfficeMlsId', 'listingOfficePhone', 'buyerAgentCommission',
  'specialConditions', 'mlsDocuments',
] as const;

function stripConfidentialFields<T extends Record<string, any>>(prop: T): Omit<T, typeof CONFIDENTIAL_MLS_FIELDS[number]> {
  const result = { ...prop };
  for (const field of CONFIDENTIAL_MLS_FIELDS) {
    delete (result as any)[field];
  }
  return result;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register auth routes first
  registerAuthRoutes(app);

  // Backfill missing lat/lng for properties without coordinates (runs once on startup)
  (async () => {
    try {
      const { geocodeAddress } = await import("./publicRecords");
      const needsGeo = await storage.getPropertiesNeedingGeocode(100);
      for (const prop of needsGeo) {
        const city = prop.addressCity || prop.location?.split(",")[0]?.trim() || "";
        const state = (prop.addressState || prop.location?.split(",")[1]?.trim() || "").trim();
        if (!city || !state) continue;
        const geo = await geocodeAddress(prop.addressStreetNumber || "", prop.addressStreetName || "", city, state, prop.addressZip || "");
        if (geo) {
          await storage.updateProperty(prop.id, { lat: String(geo.lat), lng: String(geo.lng) } as any);
        }
        await new Promise(r => setTimeout(r, 200)); // be gentle with Census API
      }
    } catch { /* non-fatal startup task */ }
  })();

  // Properties API
  app.get(api.properties.list.path, async (req, res) => {
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

  app.get("/api/properties/autocomplete", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);
      const results = await storage.autocompleteProperties(query, limit);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/locations/autocomplete", async (req, res) => {
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

  app.get("/api/properties/mine", isAuthenticated, async (req, res) => {
    try {
      const mine = await storage.getPropertiesByAgent(req.user!.claims.sub);
      res.json(mine.map(stripConfidentialFields));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get(api.properties.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    
    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    
    res.status(200).json(stripConfidentialFields(prop));
  });

  // Background geocoding: adds lat/lng to a property if address fields are present
  async function geocodeAndPatch(id: number, streetNumber: string, streetName: string, city: string, state: string, zip: string) {
    try {
      const { geocodeAddress } = await import("./publicRecords");
      const geocoded = await geocodeAddress(streetNumber, streetName, city, state, zip);
      if (geocoded) {
        await storage.updateProperty(id, { lat: String(geocoded.lat), lng: String(geocoded.lng) } as any);
      }
    } catch { /* non-fatal */ }
  }

  app.post(api.properties.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.properties.create.input.parse(req.body);
      const prop = await storage.createProperty({ ...input, agentId: user.sub });
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

  app.put(api.properties.update.path, isAuthenticated, async (req: any, res) => {
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

  app.delete(api.properties.delete.path, isAuthenticated, async (req: any, res) => {
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

  app.get("/api/properties/:id/similar", async (req, res) => {
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

      const result = similar.map(r => ({ ...stripConfidentialFields(r.property), agent: r.agent }));
      res.json(result);
    } catch (err) {
      console.error("Similar properties error:", err);
      res.status(500).json({ message: "Failed to fetch similar properties" });
    }
  });

  const soldCache = new Map<string, { data: any[]; ts: number }>();
  const SOLD_CACHE_TTL = 30 * 60 * 1000;

  app.get("/api/properties/:id/sold-nearby", async (req, res) => {
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

      const body = await apiRes.json();
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

  app.get("/api/recently-sold", async (req, res) => {
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

  // Public Records API — fetches from Census, FEMA, OpenStreetMap
  app.get("/api/properties/:id/public-records", async (req, res) => {
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

  app.get("/api/properties/:id/schools", async (req, res) => {
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

  app.get("/api/properties/:id/agent-mls", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user?.claims;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const { authStorage } = await import("./replit_integrations/auth/storage");
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

  app.get("/api/properties/:id/zoning", async (req, res) => {
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
      const { geocodeAddress } = await import("./publicRecords");
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

  app.get("/api/home-report/geocode", async (req, res) => {
    try {
      const { streetNumber, streetName, city, state, zip } = req.query as Record<string, string>;
      if (!city || !state) {
        return res.status(200).json({ lat: null, lng: null });
      }
      const { geocodeAddress } = await import("./publicRecords");
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

  app.get("/api/property-lookup", async (req, res) => {
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

  app.get("/api/home-report/public-records", async (req, res) => {
    try {
      const { streetNumber, streetName, city, state, zip } = req.query as Record<string, string>;
      if (!city || !state) {
        return res.status(200).json({ neighborhoodStats: null, floodInfo: null, nearbyPlaces: null });
      }
      const records = await getPublicRecords(streetNumber || "", streetName || "", city, state, zip || "");
      const result: any = { neighborhoodStats: null, floodInfo: null, nearbyPlaces: null };
      if (records.neighborhood) {
        result.neighborhoodStats = {
          medianIncome: records.neighborhood.medianIncome,
          medianHomeValue: records.neighborhood.medianHomeValue,
          totalPopulation: records.neighborhood.totalPopulation,
          ownerOccupiedPct: records.neighborhood.ownerOccupiedPct,
        };
      }
      if (records.flood) {
        result.floodInfo = {
          zone: records.flood.zone,
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

  app.get("/api/home-report/zoning", async (req, res) => {
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

  // Saved Properties API
  app.get(api.savedProperties.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const saved = await storage.getSavedProperties(user.sub);
      res.status(200).json(saved.map(s => ({ ...s, property: stripConfidentialFields(s.property) })));
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.savedProperties.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.savedProperties.create.input.parse(req.body);
      const saved = await storage.saveProperty(user.sub, input.propertyId, input.listId);
      res.status(201).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.savedProperties.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const propertyId = parseInt(req.params.propertyId);
      if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
      
      await storage.removeSavedProperty(user.sub, propertyId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/saved-properties/:propertyId/list", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const propertyId = parseInt(req.params.propertyId);
      if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
      const { listId } = req.body;
      await storage.movePropertyToList(user.sub, propertyId, listId ?? null);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Favorite Lists API
  app.get("/api/favorite-lists", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const lists = await storage.getFavoriteLists(user.sub);
      res.status(200).json(lists);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/favorite-lists", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
        return res.status(400).json({ message: "List name is required and must be under 100 characters" });
      }
      const list = await storage.createFavoriteList(user.sub, name.trim());
      res.status(201).json(list);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/favorite-lists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "List name is required" });
      }
      const list = await storage.renameFavoriteList(id, user.sub, name.trim());
      res.status(200).json(list);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/favorite-lists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteFavoriteList(id, user.sub);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Saved Searches API
  app.get(api.savedSearches.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const searches = await storage.getSavedSearches(user.sub);
      res.status(200).json(searches);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.savedSearches.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.savedSearches.create.input.parse(req.body);
      const search = await storage.createSavedSearch(user.sub, input);
      res.status(201).json(search);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.savedSearches.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      await storage.deleteSavedSearch(id, user.sub);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }
      await storage.renameSavedSearch(id, user.sub, name.trim());
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Profile update
  app.patch("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const userId = req.user.claims.sub;
      const profileSchema = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        phone: z.string().max(20).optional(),
      });
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      const updated = await authStorage.updateUser(userId, parsed.data);
      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Agent verification
  app.post("/api/agent/verify", isAuthenticated, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const userId = req.user.claims.sub;
      const { licenseNumber, licenseState, association, brokerageName } = req.body;

      if (!licenseNumber || typeof licenseNumber !== "string" || licenseNumber.trim().length < 2) {
        return res.status(400).json({ message: "License number is required" });
      }
      if (!/^[A-Za-z0-9\-. ]{2,30}$/.test(licenseNumber.trim())) {
        return res.status(400).json({ message: "License number contains invalid characters" });
      }

      const result = await verifyAgentLicense(licenseNumber.trim(), licenseState || undefined);

      if (result.verified) {
        const updated = await authStorage.updateAgentInfo(userId, {
          licenseNumber: licenseNumber.trim(),
          licenseState: licenseState || null,
          association: association || null,
          brokerageName: result.officeName || brokerageName || null,
          agentVerified: true,
          agentVerifiedAt: new Date(),
          agentMlsId: result.memberKey || null,
          role: "agent",
        });
        return res.json({
          verified: true,
          user: updated,
          mlsInfo: {
            memberName: result.memberName,
            officeName: result.officeName,
            memberEmail: result.memberEmail,
          },
        });
      } else {
        await authStorage.updateAgentInfo(userId, {
          licenseNumber: licenseNumber.trim(),
          licenseState: licenseState || null,
          association: association || null,
          brokerageName: brokerageName || null,
          agentVerified: false,
        });
        return res.json({
          verified: false,
          error: result.error || "Could not verify agent license",
        });
      }
    } catch (err: any) {
      console.error("Agent verify error:", err);
      res.status(500).json({ message: "Failed to verify agent license" });
    }
  });

  app.post("/api/agent/submit-info", isAuthenticated, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const userId = req.user.claims.sub;
      const { licenseNumber, licenseState, association, brokerageName } = req.body;

      if (!licenseNumber || typeof licenseNumber !== "string" || licenseNumber.trim().length < 2) {
        return res.status(400).json({ message: "License number is required" });
      }

      const updated = await authStorage.updateAgentInfo(userId, {
        licenseNumber: licenseNumber.trim(),
        licenseState: licenseState || null,
        association: association || null,
        brokerageName: brokerageName || null,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to save agent information" });
    }
  });

  // Search History
  app.get("/api/search-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getSearchHistory(userId);
      res.status(200).json(history);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/search-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query, criteria } = req.body;
      if (!query) return res.status(400).json({ message: "query required" });
      const entry = await storage.addSearchHistory(userId, query, criteria || {});
      res.status(201).json(entry);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/search-history/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteSearchHistory(id, userId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/search-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearSearchHistory(userId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // My Homes (user-tracked properties)
  app.get("/api/my-homes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const homes = await storage.getUserHomes(userId);
      res.status(200).json(homes);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/my-homes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        nickname, addressStreetNumber, addressStreetName, addressUnitNumber,
        addressCity, addressState, addressZip, notes,
        beds, baths, sqft, lotSize, yearBuilt, homeType,
        purchasePrice, purchaseDate, principalBalance, appraisedValue,
        interestRate, loanTerm, monthlyPayment, loanType, estimatedValue,
      } = req.body;
      if (!nickname) return res.status(400).json({ message: "nickname required" });

      const home = await storage.createUserHome(userId, {
        nickname, addressStreetNumber, addressStreetName, addressUnitNumber,
        addressCity, addressState, addressZip, notes, userId,
        beds, baths, sqft, lotSize, yearBuilt, homeType,
        purchasePrice, purchaseDate, principalBalance, appraisedValue,
        interestRate, loanTerm, monthlyPayment, loanType, estimatedValue,
      });

      // Geocode in background
      (async () => {
        try {
          const { geocodeAddress } = await import("./publicRecords");
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

  app.patch("/api/my-homes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const allowedFields = [
        "nickname", "addressStreetNumber", "addressStreetName", "addressUnitNumber",
        "addressCity", "addressState", "addressZip", "notes", "imageUrl",
        "beds", "baths", "sqft", "lotSize", "yearBuilt", "homeType",
        "purchasePrice", "purchaseDate", "principalBalance", "appraisedValue",
        "interestRate", "loanTerm", "monthlyPayment", "loanType", "estimatedValue",
      ];
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
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

  app.delete("/api/my-homes/:id", isAuthenticated, async (req: any, res) => {
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

  // My Home intelligence: public records + zoning for user-tracked homes
  app.get("/api/my-homes/:id/intelligence", isAuthenticated, async (req: any, res) => {
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

      const { geocodeAddress, getPublicRecords: fetchPublicRecords } = await import("./publicRecords");
      const { getZoningData } = await import("./zoningData");

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

  // ── Agent Invite / Client-Agent Links ────────────────────────────────────────

  app.get("/api/agent-invite", isAuthenticated, async (req: any, res) => {
    try {
      const link = await storage.getClientAgentLink(req.user.sub);
      res.json(link ?? null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/agent-invite", isAuthenticated, async (req: any, res) => {
    try {
      const { agentEmail } = req.body;
      if (!agentEmail) return res.status(400).json({ message: "agentEmail required" });
      const link = await storage.upsertClientAgentLink(req.user.sub, agentEmail.trim().toLowerCase());
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/agent-invite", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteClientAgentLink(req.user.sub);
      res.json({ message: "Removed" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Agent sees all linked clients
  app.get("/api/agent-clients", isAuthenticated, async (req: any, res) => {
    try {
      const { email } = req.user as any;
      const clients = await storage.getAgentClients(email);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Agent views a specific client's saved properties
  app.get("/api/agent-clients/:clientId/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const agentEmail = req.user.email;
      const clients = await storage.getAgentClients(agentEmail);
      if (!clients.find(c => c.clientId === clientId)) {
        return res.status(403).json({ message: "Not authorized to view this client" });
      }
      const saved = await storage.getSavedProperties(clientId);
      res.json(saved.map(s => ({ ...s, property: stripConfidentialFields(s.property) })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Agent views a specific client's saved searches
  app.get("/api/agent-clients/:clientId/searches", isAuthenticated, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const agentEmail = req.user.email;
      const clients = await storage.getAgentClients(agentEmail);
      if (!clients.find(c => c.clientId === clientId)) {
        return res.status(403).json({ message: "Not authorized to view this client" });
      }
      const searches = await storage.getSavedSearches(clientId);
      res.json(searches);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Agent CRM - Contacts ──────────────────────────────────────────────────────

  app.get("/api/agent/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const tagId = req.query.tagId ? Number(req.query.tagId) : undefined;
      const contacts = await storage.getAgentContacts(agentId, tagId);
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/agent/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const { firstName, lastName, email, phone, mailingAddress, notes, source, tagIds } = req.body;
      if (!firstName) return res.status(400).json({ message: "First name is required" });
      const contact = await storage.createAgentContact({
        agentId, firstName, lastName, email, phone, mailingAddress, notes,
        source: source || "manual",
      });
      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        const ownedTags = await storage.getContactTags(agentId);
        const ownedIds = new Set(ownedTags.map(t => t.id));
        for (const tagId of tagIds) {
          if (ownedIds.has(tagId)) {
            await storage.assignTagToContact(contact.id, tagId);
          }
        }
      }
      const full = await storage.getAgentContact(contact.id, agentId);
      res.status(201).json(full);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/agent/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const id = Number(req.params.id);
      const { firstName, lastName, email, phone, mailingAddress, notes } = req.body;
      const updated = await storage.updateAgentContact(id, agentId, {
        firstName, lastName, email, phone, mailingAddress, notes,
      });
      if (!updated) return res.status(404).json({ message: "Contact not found" });
      const full = await storage.getAgentContact(id, agentId);
      res.json(full);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/agent/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      await storage.deleteAgentContact(Number(req.params.id), agentId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/agent/contacts/import-csv", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const { contacts, tagIds } = req.body;
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "No contacts provided" });
      }
      if (contacts.length > 1000) {
        return res.status(400).json({ message: "Maximum 1000 contacts per import" });
      }

      const toInsert = contacts.map((c: any) => ({
        agentId,
        firstName: c.firstName || "Unknown",
        lastName: c.lastName || null,
        email: c.email || null,
        phone: c.phone || null,
        mailingAddress: c.mailingAddress || null,
        notes: c.notes || null,
        source: "csv_import" as const,
      }));

      const created = await storage.createAgentContactsBulk(toInsert);

      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        const ownedTags = await storage.getContactTags(agentId);
        const ownedIds = new Set(ownedTags.map(t => t.id));
        const validTagIds = tagIds.filter((id: number) => ownedIds.has(id));
        const createdIds = created.map(c => c.id);
        for (const tagId of validTagIds) {
          await storage.assignTagToContacts(createdIds, tagId);
        }
      }

      res.status(201).json({ imported: created.length });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/agent/contacts/import-phone", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const { contacts, tagIds } = req.body;
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "No contacts provided" });
      }

      const toInsert = contacts.map((c: any) => ({
        agentId,
        firstName: c.firstName || c.name?.split(" ")[0] || "Unknown",
        lastName: c.lastName || c.name?.split(" ").slice(1).join(" ") || null,
        email: c.email || null,
        phone: c.phone || null,
        source: "phone_import" as const,
      }));

      const created = await storage.createAgentContactsBulk(toInsert);

      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        const ownedTags = await storage.getContactTags(agentId);
        const ownedIds = new Set(ownedTags.map(t => t.id));
        const validTagIds = tagIds.filter((id: number) => ownedIds.has(id));
        for (const tagId of validTagIds) {
          await storage.assignTagToContacts(created.map(c => c.id), tagId);
        }
      }

      res.status(201).json({ imported: created.length });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Agent CRM - Tags ────────────────────────────────────────────────────────

  app.get("/api/agent/tags", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const tags = await storage.getContactTags(agentId);
      res.json(tags);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/agent/tags", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ message: "Tag name is required" });
      const tag = await storage.createContactTag({ agentId, name, color: color || "blue" });
      res.status(201).json(tag);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/agent/tags/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const { name, color } = req.body;
      const updated = await storage.updateContactTag(Number(req.params.id), agentId, { name, color });
      if (!updated) return res.status(404).json({ message: "Tag not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/agent/tags/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      await storage.deleteContactTag(Number(req.params.id), agentId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Agent CRM - Tag Assignments ──────────────────────────────────────────────

  app.post("/api/agent/contacts/:id/tags", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const contactId = Number(req.params.id);
      const { tagId } = req.body;
      if (!tagId) return res.status(400).json({ message: "tagId is required" });
      const contact = await storage.getAgentContact(contactId, agentId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      const tags = await storage.getContactTags(agentId);
      if (!tags.find(t => t.id === tagId)) return res.status(403).json({ message: "Tag not owned by you" });
      const assignment = await storage.assignTagToContact(contactId, tagId);
      res.status(201).json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/agent/contacts/:id/tags/:tagId", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user!.claims.sub;
      const contactId = Number(req.params.id);
      const tagId = Number(req.params.tagId);
      const contact = await storage.getAgentContact(contactId, agentId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      await storage.removeTagFromContact(contactId, tagId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Open Houses ───────────────────────────────────────────────────────────────

  app.get("/api/open-houses", async (_req, res) => {
    try {
      const openHouses = await storage.getUpcomingOpenHouses();
      res.json(openHouses);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Sell / Valuation Routes ─────────────────────────────────────────────────

  app.get("/api/valuation", async (req, res) => {
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

  app.post("/api/sell-leads", async (req, res) => {
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
      res.status(201).json({ ...newLead, agentLinked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Property Reviews & Ratings ───────────────────────────────────────────

  app.get("/api/properties/:id/reviews", async (req, res) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
      const reviews = await storage.getPropertyReviews(propertyId);
      const publicReviews = reviews
        .filter(r => r.isPublic)
        .map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          isPublic: r.isPublic,
          user: r.user ? {
            firstName: r.user.firstName || "Anonymous",
            lastInitial: r.user.lastName ? r.user.lastName.charAt(0) + "." : "",
            profileImageUrl: r.user.profileImageUrl,
          } : { firstName: "Anonymous", lastInitial: "", profileImageUrl: null },
        }));
      res.json(publicReviews);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/properties/:id/reviews/all", isAuthenticated, async (req: any, res) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.email === process.env.ADMIN_EMAIL;
      const isAgent = user?.role === "agent";

      if (!isAdmin && !isAgent) {
        return res.status(403).json({ message: "Agents and admin only" });
      }

      const prop = await storage.getProperty(propertyId);
      if (!prop) return res.status(404).json({ message: "Property not found" });

      if (!isAdmin && prop.agentId !== userId) {
        return res.status(403).json({ message: "Only the listing agent or admin can view all reviews" });
      }

      const reviews = await storage.getPropertyReviews(propertyId);
      res.json(reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        isPublic: r.isPublic,
        moderatedBy: r.moderatedBy,
        userId: r.userId,
        user: r.user ? {
          firstName: r.user.firstName || "Anonymous",
          lastInitial: r.user.lastName ? r.user.lastName.charAt(0) + "." : "",
          profileImageUrl: r.user.profileImageUrl,
        } : { firstName: "Anonymous", lastInitial: "", profileImageUrl: null },
      })));
    } catch (err) {
      console.error("Error fetching all reviews for property", req.params.id, err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/profile/completeness", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const missing: string[] = [];
      if (!user.profileImageUrl) missing.push("photo");
      if (!user.emailVerified) missing.push("emailVerified");
      if (!user.phone) missing.push("phone");
      if (!user.mailingAddress) missing.push("mailingAddress");
      res.json({ complete: missing.length === 0, missing, profile: {
        hasPhoto: !!user.profileImageUrl,
        emailVerified: !!user.emailVerified,
        hasPhone: !!user.phone,
        hasMailingAddress: !!user.mailingAddress,
      }});
    } catch (err) {
      console.error("Error fetching profile completeness for user", req.user?.claims?.sub, err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { phone, mailingAddress } = req.body;
      const updates: any = {};
      if (phone !== undefined) updates.phone = phone;
      if (mailingAddress !== undefined) updates.mailingAddress = mailingAddress;
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/properties/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
      const userId = req.user.claims.sub;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const missing: string[] = [];
      if (!user.profileImageUrl) missing.push("photo");
      if (!user.emailVerified) missing.push("emailVerified");
      if (!user.phone) missing.push("phone");
      if (!user.mailingAddress) missing.push("mailingAddress");
      if (missing.length > 0) {
        return res.status(403).json({ message: "Complete your profile to leave a review", missing });
      }

      const existing = await storage.getUserReviewForProperty(userId, propertyId);
      if (existing) {
        return res.status(409).json({ message: "You have already reviewed this property" });
      }

      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      if (!comment || typeof comment !== "string" || comment.length > 300) {
        return res.status(400).json({ message: "Comment is required and must be 300 characters or less" });
      }

      const prop = await storage.getProperty(propertyId);
      if (!prop) return res.status(404).json({ message: "Property not found" });

      const review = await storage.createPropertyReview({
        propertyId,
        userId,
        rating,
        comment: comment.trim(),
        isPublic: true,
      });
      res.status(201).json(review);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/reviews/:id/visibility", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.email === process.env.ADMIN_EMAIL;

      const [review] = await db.select().from(propertyReviews).where(eq(propertyReviews.id, id));
      if (!review) return res.status(404).json({ message: "Review not found" });

      const [property] = await db.select().from(properties).where(eq(properties.id, review.propertyId));
      const isListingAgent = property && property.agentId === userId;

      if (!isAdmin && !isListingAgent) {
        return res.status(403).json({ message: "Only the listing agent or admin can moderate reviews" });
      }
      const { isPublic } = req.body;
      if (typeof isPublic !== "boolean") {
        return res.status(400).json({ message: "isPublic must be a boolean" });
      }
      const updated = await storage.updateReviewVisibility(id, isPublic, userId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/reviews/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.email === process.env.ADMIN_EMAIL;

      const reviews = await db.select().from(propertyReviews).where(eq(propertyReviews.id, id));
      const review = reviews[0];
      if (!review) return res.status(404).json({ message: "Review not found" });

      if (review.userId !== userId && !isAdmin) {
        const prop = await storage.getProperty(review.propertyId);
        if (!prop || prop.agentId !== userId) {
          return res.status(403).json({ message: "Not authorized to delete this review" });
        }
      }

      await storage.deletePropertyReview(id);
      res.json({ message: "Review deleted" });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── Swipe Interest & Reverse Offers ──────────────────────────────────────

  app.post("/api/swipe-interest", isAuthenticated, async (req: any, res) => {
    try {
      const buyerUserId = req.user.claims.sub;
      const { propertyId } = req.body;
      if (!propertyId) return res.status(400).json({ message: "propertyId required" });

      await storage.upsertBuyerInterest(propertyId, buyerUserId, "swipe");

      const existing = await storage.getExistingSwipeNotification(buyerUserId, propertyId);
      if (existing) return res.status(200).json({ message: "Already notified", notification: existing });

      const prop = await storage.getProperty(propertyId);
      if (!prop) return res.status(404).json({ message: "Property not found" });

      const buyerProfile = await storage.getUserBuyerProfile(buyerUserId);
      const buyerLink = await storage.getClientAgentLink(buyerUserId);

      const buyerRepresented = !!(
        (buyerProfile && (buyerProfile.agentId || buyerProfile.buyerAgentEmail)) ||
        (buyerLink && buyerLink.agentId)
      );
      const buyerAgentEmail = buyerProfile?.buyerAgentEmail || buyerLink?.agentEmail || null;

      const sellerRepresented = !!(prop.agentId || prop.listingAgentEmail);
      const listingAgentEmail = prop.listingAgentEmail || null;

      const adminEmail = process.env.ADMIN_EMAIL || "";
      const adminUser = adminEmail
        ? await db.select().from(users).where(eq(users.email, adminEmail)).limit(1).then(r => r[0])
        : null;

      const notifications: any[] = [];

      if (sellerRepresented) {
        if (prop.agentId) {
          notifications.push({
            buyerUserId,
            propertyId,
            notifiedParty: "listing_agent",
            notifiedUserId: prop.agentId,
            notifiedEmail: prop.listingAgentEmail || "",
            buyerRepresented,
            sellerRepresented: true,
            buyerAgentEmail,
            listingAgentEmail,
            status: "notified",
          });
        } else if (prop.listingAgentEmail) {
          notifications.push({
            buyerUserId,
            propertyId,
            notifiedParty: "listing_agent",
            notifiedUserId: null,
            notifiedEmail: prop.listingAgentEmail,
            buyerRepresented,
            sellerRepresented: true,
            buyerAgentEmail,
            listingAgentEmail,
            status: "notified",
          });
        }
      } else {
        notifications.push({
          buyerUserId,
          propertyId,
          notifiedParty: "admin",
          notifiedUserId: adminUser?.id || null,
          notifiedEmail: adminEmail,
          buyerRepresented,
          sellerRepresented: false,
          buyerAgentEmail,
          listingAgentEmail: null,
          status: "notified",
        });
      }

      if (!buyerRepresented) {
        const alreadyHasAdminNotif = notifications.some(n => n.notifiedParty === "admin");
        if (!alreadyHasAdminNotif) {
          notifications.push({
            buyerUserId,
            propertyId,
            notifiedParty: "admin",
            notifiedUserId: adminUser?.id || null,
            notifiedEmail: adminEmail,
            buyerRepresented: false,
            sellerRepresented,
            buyerAgentEmail: null,
            listingAgentEmail,
            status: "notified",
          });
        } else {
          const adminNotif = notifications.find(n => n.notifiedParty === "admin");
          if (adminNotif) adminNotif.buyerRepresented = false;
        }
      }

      const created = [];
      for (const notif of notifications) {
        const n = await storage.createSwipeNotification(notif);
        created.push(n);
      }

      res.status(201).json({
        message: "Interest registered",
        notifications: created,
        buyerRepresented,
        sellerRepresented,
      });
    } catch (err) {
      console.error("Swipe interest error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/property-offers", isAuthenticated, async (req: any, res) => {
    try {
      const creatorId = req.user.claims.sub;
      const {
        propertyId, buyerUserId, offerPrice, escrowLengthDays,
        inspectionContingencyDays, loanContingencyDays, appraisalContingencyDays,
        insuranceContingencyDays, disclosureReviewDays, leasedLienedItemsDays,
        sellerConcessions, sellerConcessionNotes,
        buydownOffered, buydownType, buydownAmount,
        additionalTerms, swipeNotificationId,
      } = req.body;

      if (!propertyId || !buyerUserId) {
        return res.status(400).json({ message: "propertyId and buyerUserId required" });
      }

      const prop = await storage.getProperty(propertyId);
      if (!prop) return res.status(404).json({ message: "Property not found" });

      const creator = await storage.getUser(creatorId);
      const isAdmin = creator?.email === process.env.ADMIN_EMAIL;
      const isListingAgent = prop.agentId === creatorId;
      if (!isListingAgent && !isAdmin) {
        return res.status(403).json({ message: "Only the listing agent or admin can create reverse offers" });
      }

      const buyerProfile = await storage.getUserBuyerProfile(buyerUserId);
      const buyerLink = await storage.getClientAgentLink(buyerUserId);
      const buyerAgentId = buyerProfile?.agentId || buyerLink?.agentId || null;

      const offer = await storage.createPropertyOffer({
        propertyId,
        buyerUserId,
        buyerProfileId: buyerProfile?.id || null,
        sellerUserId: prop.agentId || null,
        listingAgentId: prop.agentId || null,
        buyerAgentId,
        offerPrice: offerPrice || prop.price,
        escrowLengthDays: escrowLengthDays || 30,
        inspectionContingencyDays: inspectionContingencyDays ?? 17,
        loanContingencyDays: loanContingencyDays ?? 21,
        appraisalContingencyDays: appraisalContingencyDays ?? 17,
        insuranceContingencyDays: insuranceContingencyDays ?? 5,
        disclosureReviewDays: disclosureReviewDays ?? 7,
        leasedLienedItemsDays: leasedLienedItemsDays ?? 5,
        sellerConcessions: sellerConcessions || 0,
        sellerConcessionNotes: sellerConcessionNotes || null,
        buydownOffered: buydownOffered || false,
        buydownType: buydownType || null,
        buydownAmount: buydownAmount || null,
        additionalTerms: additionalTerms || null,
        status: "sent_to_buyer",
        triggeredBySwipe: !!swipeNotificationId,
      });

      if (swipeNotificationId) {
        await storage.updateSwipeNotificationStatus(swipeNotificationId, "offer_created", offer.id);
      }

      res.status(201).json(offer);
    } catch (err) {
      console.error("Create property offer error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/property-offers/incoming", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const offers = await storage.getPropertyOffersForBuyer(userId);
      res.json(offers);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/property-offers/agent", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.user.claims.sub;
      const offers = await storage.getPropertyOffersForAgent(agentId);
      res.json(offers);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/swipe-notifications/agent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getSwipeNotificationsForUser(userId);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/property-offers/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { status, adminNotes } = req.body;
      if (!status) return res.status(400).json({ message: "status required" });

      const validStatuses = ["pending_agent_review", "sent_to_buyer", "viewed", "accepted", "rejected", "countered", "declined", "expired", "pending_admin"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user?.email === process.env.ADMIN_EMAIL;

      const offers = await db.select().from(propertyOffers).where(eq(propertyOffers.id, id));
      const offer = offers[0];
      if (!offer) return res.status(404).json({ message: "Offer not found" });

      const buyerStatuses = ["accepted", "rejected", "declined", "countered", "viewed"];
      const agentStatuses = ["sent_to_buyer", "pending_agent_review", "expired"];

      if (buyerStatuses.includes(status) && offer.buyerUserId !== userId && !isAdminUser) {
        return res.status(403).json({ message: "Only the buyer can respond to this offer" });
      }
      if (agentStatuses.includes(status) && offer.listingAgentId !== userId && !isAdminUser) {
        return res.status(403).json({ message: "Only the listing agent or admin can update this status" });
      }

      const updated = await storage.updatePropertyOfferStatus(id, status, adminNotes);

      const offerResponseStatuses = ["accepted", "rejected", "declined", "countered"];
      if (offerResponseStatuses.includes(status) && offer.propertyId) {
        const statusLabel = status === "countered" ? "counter-offered" : status;
        const buyerUser = await storage.getUser(offer.buyerUserId!);
        const buyerName = buyerUser?.firstName ? `${buyerUser.firstName} ${buyerUser.lastName || ""}`.trim() : "Buyer";
        const agentId = offer.listingAgentId;

        if (agentId) {
          const convo = await storage.getOrCreateConversation(offer.propertyId, offer.buyerUserId!, agentId);
          await storage.createMessage({
            conversationId: convo.id,
            senderUserId: userId,
            type: "system",
            content: `${buyerName} has ${statusLabel} the offer.`,
          });

          const now = new Date();
          await db.update(buyerInterest)
            .set({ stage: "offer", lastActivityAt: now, updatedAt: now })
            .where(and(eq(buyerInterest.propertyId, offer.propertyId), eq(buyerInterest.buyerUserId, offer.buyerUserId!)));

          const recipientId = userId === offer.buyerUserId ? agentId : offer.buyerUserId!;
          const offerNotifTitle = `Offer ${statusLabel}`;
          const offerNotifMsg = `${buyerName} has ${statusLabel} the offer on the property.`;
          await storage.createNotification({
            userId: recipientId,
            type: "offer_response",
            title: offerNotifTitle,
            message: offerNotifMsg,
            propertyId: offer.propertyId,
            linkUrl: `/conversations/${convo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(recipientId, "offer_response", offerNotifTitle, offerNotifMsg, `/conversations/${convo.id}`, offer.propertyId, convo.id);
        }
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── Seller Pitches ─────────────────────────────────────────────────────────

  const isAdmin = async (req: any, res: any, next: any) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || !req.user?.claims?.sub) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const user = await authStorage.getUser(req.user.claims.sub);
    if (!user?.email || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  app.post("/api/seller-pitches", async (req: any, res) => {
    try {
      const body = req.body;
      if (!body.name || !body.email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      const userId = req.user?.claims?.sub || null;
      const pitch = await storage.createSellerPitch({ ...body, userId });
      res.status(201).json(pitch);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/seller-pitches", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const pitches = await storage.getSellerPitches();
      res.json(pitches);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/seller-pitches/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const pitch = await storage.getSellerPitch(id);
      if (!pitch) return res.status(404).json({ message: "Pitch not found" });
      res.json(pitch);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/seller-pitches/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { status, adminNotes } = req.body;
      if (!status) return res.status(400).json({ message: "Status is required" });
      const updated = await storage.updateSellerPitchStatus(id, status, adminNotes);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/sell-leads", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const leads = await storage.getSellLeads();
      res.json(leads);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const [pitches, leads, profiles, totalProperties] = await Promise.all([
        storage.getSellerPitches(),
        storage.getSellLeads(),
        storage.getBuyerProfiles(),
        storage.getPropertiesCount(),
      ]);
      res.json({
        totalPitches: pitches.length,
        newPitches: pitches.filter(p => p.status === "new").length,
        totalSellLeads: leads.length,
        totalBuyerProfiles: profiles.length,
        totalProperties,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/swipe-notifications", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const notifications = await storage.getAdminSwipeNotifications();
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/conversations", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const rawLimit = parseInt(req.query.limit as string);
      const rawOffset = parseInt(req.query.offset as string);
      const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
      const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);
      const result = await storage.getAllConversations({ search, status, limit, offset });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/conversations/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid conversation ID" });
      const result = await storage.getConversationWithMessages(id);
      if (!result) return res.status(404).json({ message: "Conversation not found" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/property-offers", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const rows = await db
        .select({ offer: propertyOffers, property: properties, buyer: users })
        .from(propertyOffers)
        .innerJoin(properties, eq(propertyOffers.propertyId, properties.id))
        .leftJoin(users, eq(propertyOffers.buyerUserId, users.id))
        .orderBy(desc(propertyOffers.createdAt));
      res.json(rows.map(r => ({ ...r.offer, property: r.property, buyer: r.buyer })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/buyer-pitches", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allMatches = await db
        .select({
          match: buyerMatches,
          buyerProfile: buyerProfiles,
          sender: users,
        })
        .from(buyerMatches)
        .innerJoin(buyerProfiles, eq(buyerMatches.buyerProfileId, buyerProfiles.id))
        .leftJoin(users, eq(buyerMatches.senderId, users.id))
        .where(sql`${buyerProfiles.agentId} IS NOT NULL`)
        .orderBy(desc(buyerMatches.createdAt));

      res.json(allMatches.map(r => ({
        ...r.match,
        buyerProfile: r.buyerProfile,
        sender: r.sender,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/buyer-referrals", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const referrals = await db
        .select({ profile: buyerProfiles, user: users })
        .from(buyerProfiles)
        .leftJoin(users, eq(buyerProfiles.userId, users.id))
        .where(
          sql`${buyerProfiles.needsLenderReferral} = true OR ${buyerProfiles.needsAgentReferral} = true`
        )
        .orderBy(desc(buyerProfiles.createdAt));
      res.json(referrals.map(r => ({ ...r.profile, user: r.user, type: "buyer" })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/seller-referrals", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const leads = await db
        .select()
        .from(sellLeads)
        .where(
          sql`${sellLeads.needsLenderReferral} = true OR ${sellLeads.needsAgentReferral} = true`
        )
        .orderBy(desc(sellLeads.createdAt));
      res.json(leads.map((l: any) => ({ ...l, type: "seller" })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin User Management ─────────────────────────────────────────────────

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allUsers = await authStorage.getAllUsers();
      const usersWithActivity = await Promise.all(
        allUsers.map(async (u) => {
          const activity = await authStorage.getUserActivity(u.id);
          return { ...u, activity };
        })
      );
      res.json(usersWithActivity);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await authStorage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const activity = await authStorage.getUserActivity(req.params.id);
      res.json({ ...user, activity });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const patchSchema = z.object({
        role: z.enum(["user", "agent", "admin"]).optional(),
        status: z.enum(["active", "suspended", "banned"]).optional(),
        adminNotes: z.string().optional(),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const existing = await authStorage.getUser(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "User not found" });
      }
      const updates: any = {};
      if (parsed.data.role !== undefined) updates.role = parsed.data.role;
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;
      if (parsed.data.adminNotes !== undefined) updates.adminNotes = parsed.data.adminNotes;
      const updated = await authStorage.adminUpdateUser(req.params.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const targetId = req.params.id;
      const adminSub = (req as any).user?.claims?.sub;
      if (targetId === adminSub) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      const existing = await authStorage.getUser(targetId);
      if (!existing) {
        return res.status(404).json({ message: "User not found" });
      }
      await db.transaction(async (tx) => {
        await tx.delete(savedProperties).where(eq(savedProperties.userId, targetId));
        await tx.delete(savedSearches).where(eq(savedSearches.userId, targetId));
        await tx.delete(searchHistory).where(eq(searchHistory.userId, targetId));
        await tx.delete(userHomes).where(eq(userHomes.userId, targetId));
        await tx.delete(favoriteLists).where(eq(favoriteLists.userId, targetId));
        const userProfiles = await tx.select({ id: buyerProfiles.id }).from(buyerProfiles).where(eq(buyerProfiles.userId, targetId));
        for (const bp of userProfiles) {
          await tx.delete(buyerMatches).where(eq(buyerMatches.buyerProfileId, bp.id));
        }
        await tx.delete(buyerMatches).where(eq(buyerMatches.senderId, targetId));
        await tx.delete(buyerProfiles).where(eq(buyerProfiles.userId, targetId));
        await tx.delete(sellerPitches).where(eq(sellerPitches.userId, targetId));
        await tx.delete(clientAgentLinks).where(
          or(eq(clientAgentLinks.clientId, targetId), eq(clientAgentLinks.agentId, targetId))
        );
        const userProperties = await tx.select({ id: properties.id }).from(properties).where(eq(properties.agentId, targetId));
        for (const prop of userProperties) {
          await tx.delete(buyerMatches).where(eq(buyerMatches.propertyId, prop.id));
          await tx.delete(savedProperties).where(eq(savedProperties.propertyId, prop.id));
        }
        await tx.delete(properties).where(eq(properties.agentId, targetId));
        await tx.delete(users).where(eq(users.id, targetId));
      });
      res.json({ message: "User deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Buyer Profiles ──────────────────────────────────────────────────────────

  function redactBuyerProfile(profile: any) {
    const {
      clientName, clientEmail, clientPhone,
      preApprovalLetter, lenderName, lenderPhone, lenderEmail,
      buyerAgentName, buyerAgentPhone, buyerAgentEmail,
      needsLenderReferral, needsAgentReferral,
      ...safe
    } = profile;
    return safe;
  }

  app.get("/api/beacon/match-buyers", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user?.claims;
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const dbUser = await authStorage.getUser(user.sub);
      if (!dbUser || dbUser.role !== "agent" || dbUser.agentVerified !== true) {
        return res.status(403).json({ message: "Agent access required" });
      }

      const schema = z.object({
        price: z.coerce.number().positive(),
        beds: z.coerce.number().min(0),
        baths: z.coerce.number().min(0),
        sqft: z.coerce.number().min(0),
        city: z.string().min(1),
        propertyType: z.string().optional().default(""),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: "Invalid parameters", errors: parsed.error.flatten() });

      const matches = await storage.matchBuyersForListing(parsed.data);

      const safeMatches = matches.map(profile => ({
        id: profile.id,
        displayName: profile.displayName,
        preApprovalAmount: profile.preApprovalAmount,
        isPreApproved: profile.isPreApproved,
        minBeds: profile.minBeds,
        maxBeds: profile.maxBeds,
        minBaths: profile.minBaths,
        minSqft: profile.minSqft,
        maxSqft: profile.maxSqft,
        preferredCities: profile.preferredCities,
        homeTypes: profile.homeTypes,
        mustHaves: profile.mustHaves,
        niceToHaves: profile.niceToHaves,
        moveInTimeline: profile.moveInTimeline,
        hasAgent: profile.hasAgent,
        bio: profile.bio,
      }));

      res.json({ matches: safeMatches, total: safeMatches.length });
    } catch (err) {
      console.error("Beacon match error:", err);
      res.status(500).json({ message: "Failed to match buyers" });
    }
  });

  app.get("/api/buyer-profiles", async (req, res) => {
    try {
      const profiles = await storage.getBuyerProfiles(req.query);
      res.json(profiles.map(redactBuyerProfile));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/buyer-profiles/mine", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getUserBuyerProfile(req.user!.claims.sub);
      res.json(profile || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/buyer-profiles/:id", async (req, res) => {
    try {
      const profile = await storage.getBuyerProfile(parseInt(req.params.id));
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(redactBuyerProfile(profile));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const FAIR_HOUSING_PROHIBITED = [
    "no kids", "no children", "no families", "adults only", "no section 8",
    "christian", "muslim", "jewish", "hindu", "buddhist", "catholic",
    "whites only", "no blacks", "no hispanics", "no asians", "no mexicans",
    "english only", "american only", "no immigrants", "no foreigners",
    "no disabled", "no wheelchair", "no handicap", "able-bodied only",
    "no gay", "no lgbtq", "straight only", "no trans",
    "no single mothers", "no single parents", "married only", "couples only",
    "no elderly", "young only", "no seniors",
  ];

  function checkFairHousing(text: string): string | null {
    const lower = text.toLowerCase();
    for (const term of FAIR_HOUSING_PROHIBITED) {
      if (lower.includes(term)) {
        return `Content contains language ("${term}") that may violate the Fair Housing Act. Please describe only property features.`;
      }
    }
    return null;
  }

  app.post("/api/buyer-profiles", isAuthenticated, async (req, res) => {
    try {
      const { insertBuyerProfileSchema } = await import("@shared/schema");
      const parsed = insertBuyerProfileSchema.omit({ userId: true, agentId: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const textToCheck = [
        ...(parsed.data.mustHaves || []),
        ...(parsed.data.niceToHaves || []),
        ...(parsed.data.dealBreakers || []),
        parsed.data.bio || "",
      ].join(" ");
      const violation = checkFairHousing(textToCheck);
      if (violation) return res.status(400).json({ message: violation });

      let agentId: string | null = null;
      let agentLinked = false;
      if (parsed.data.hasAgent && parsed.data.buyerAgentEmail) {
        const agentUser = await db.select().from(users)
          .where(eq(users.email, parsed.data.buyerAgentEmail.trim().toLowerCase()))
          .limit(1);
        if (agentUser.length > 0) {
          agentId = agentUser[0].id;
          agentLinked = true;
        }
      }

      const data = {
        ...parsed.data,
        userId: req.user!.claims.sub,
        agentId,
        needsLenderReferral: parsed.data.isPreApproved === false,
        needsAgentReferral: parsed.data.hasAgent === false,
      };
      const profile = await storage.createBuyerProfile(data);
      res.status(201).json({ ...profile, agentLinked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/buyer-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const { insertBuyerProfileSchema } = await import("@shared/schema");
      const parsed = insertBuyerProfileSchema.omit({ userId: true }).partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const textToCheck = [
        ...(parsed.data.mustHaves || []),
        ...(parsed.data.niceToHaves || []),
        ...(parsed.data.dealBreakers || []),
        parsed.data.bio || "",
      ].join(" ");
      const violation = checkFairHousing(textToCheck);
      if (violation) return res.status(400).json({ message: violation });

      const updateData: any = { ...parsed.data };

      if (parsed.data.hasAgent !== undefined) {
        updateData.needsAgentReferral = parsed.data.hasAgent === false;
      }
      if (parsed.data.isPreApproved !== undefined) {
        updateData.needsLenderReferral = parsed.data.isPreApproved === false;
      }

      if (parsed.data.hasAgent && parsed.data.buyerAgentEmail) {
        const agentUser = await db.select().from(users)
          .where(eq(users.email, parsed.data.buyerAgentEmail.trim().toLowerCase()))
          .limit(1);
        if (agentUser.length > 0) {
          updateData.agentId = agentUser[0].id;
        }
      } else if (parsed.data.hasAgent === false) {
        updateData.agentId = null;
        updateData.buyerAgentName = null;
        updateData.buyerAgentPhone = null;
        updateData.buyerAgentEmail = null;
      }

      const updated = await storage.updateBuyerProfile(
        parseInt(req.params.id),
        req.user!.claims.sub,
        updateData
      );
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/buyer-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteBuyerProfile(parseInt(req.params.id), req.user!.claims.sub);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/agent/buyer-clients", isAuthenticated, async (req, res) => {
    try {
      const profiles = await storage.getAgentBuyerProfiles(req.user!.claims.sub);
      res.json(profiles);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/agent/buyer-clients", isAuthenticated, async (req, res) => {
    try {
      const { insertBuyerProfileSchema } = await import("@shared/schema");
      const parsed = insertBuyerProfileSchema.omit({ userId: true, agentId: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const textToCheck = [
        ...(parsed.data.mustHaves || []),
        ...(parsed.data.niceToHaves || []),
        ...(parsed.data.dealBreakers || []),
        parsed.data.bio || "",
      ].join(" ");
      const violation = checkFairHousing(textToCheck);
      if (violation) return res.status(400).json({ message: violation });
      const agentId = req.user!.claims.sub;
      const data = { ...parsed.data, userId: agentId, agentId };
      const profile = await storage.createBuyerProfile(data);
      res.status(201).json(profile);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/agent/buyer-clients/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getBuyerProfile(id);
      if (!profile || profile.agentId !== req.user!.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { insertBuyerProfileSchema } = await import("@shared/schema");
      const parsed = insertBuyerProfileSchema.omit({ userId: true, agentId: true }).partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const updated = await storage.updateBuyerProfile(id, profile.userId, parsed.data);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/agent/buyer-clients/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getBuyerProfile(id);
      if (!profile || profile.agentId !== req.user!.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteBuyerProfile(id, profile.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Buyer Matches (Pitches) ────────────────────────────────────────────────

  app.post("/api/buyer-matches", isAuthenticated, async (req, res) => {
    try {
      const { insertBuyerMatchSchema } = await import("@shared/schema");
      const parsed = insertBuyerMatchSchema.omit({ senderId: true, conversationId: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      if (parsed.data.message) {
        const violation = checkFairHousing(parsed.data.message);
        if (violation) return res.status(400).json({ message: violation });
      }
      const userId = req.user!.claims.sub;

      if (parsed.data.propertyId) {
        const property = await storage.getProperty(parsed.data.propertyId);
        if (!property) return res.status(404).json({ message: "Property not found" });
        if (property.agentId !== userId) {
          const user = await storage.getUser(userId);
          const isAdmin = !!(process.env.ADMIN_EMAIL && user?.email && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase());
          if (!isAdmin) {
            return res.status(403).json({ message: "You can only pitch properties you own" });
          }
        }
      }

      const data = { ...parsed.data, senderId: userId };
      const match = await storage.createBuyerMatch(data);

      const profile = await storage.getBuyerProfile(parsed.data.buyerProfileId);
      if (profile && parsed.data.propertyId && parsed.data.message) {
        const buyerUserId = profile.userId;
        const convo = await storage.getOrCreateConversation(parsed.data.propertyId, buyerUserId, userId, "seller");
        await storage.createMessage({
          conversationId: convo.id,
          senderUserId: userId,
          type: "pitch",
          content: parsed.data.message,
        });
        await storage.updateBuyerMatchConversationId(match.id, convo.id);

        const senderUser = await storage.getUser(userId);
        const senderName = senderUser?.firstName ? `${senderUser.firstName} ${senderUser.lastName || ""}`.trim() : "A seller";

        await storage.createNotification({
          userId: buyerUserId,
          type: "message_received",
          title: `New pitch from ${senderName}`,
          message: (parsed.data.message || "").substring(0, 200),
          propertyId: parsed.data.propertyId,
          linkUrl: `/conversations/${convo.id}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(buyerUserId, "message_received", `New pitch from ${senderName}`, (parsed.data.message || "").substring(0, 200), `/conversations/${convo.id}`, parsed.data.propertyId, convo.id);

        if (profile.agentId) {
          await storage.createNotification({
            userId: profile.agentId,
            type: "message_received",
            title: `Seller pitch to your client ${profile.displayName}`,
            message: `${senderName} pitched a property to your client. ${(parsed.data.message || "").substring(0, 100)}`,
            propertyId: parsed.data.propertyId,
            linkUrl: `/conversations/${convo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(profile.agentId, "message_received", `Seller pitch to your client ${profile.displayName}`, `${senderName} pitched a property to your client.`, `/conversations/${convo.id}`, parsed.data.propertyId, convo.id);
        }
      }

      res.status(201).json(match);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/buyer-matches/profile/:profileId", isAuthenticated, async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = await storage.getBuyerProfile(profileId);
      if (!profile || profile.userId !== req.user!.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      const matches = await storage.getBuyerMatchesForProfile(profileId);
      res.json(matches);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/buyer-matches/sent", isAuthenticated, async (req, res) => {
    try {
      const matches = await storage.getBuyerMatchesForSender(req.user!.claims.sub);
      res.json(matches);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── IDX / MLS Sync Routes ────────────────────────────────────────────────────

  // Status — is IDX configured, last sync result, sync history
  app.get("/api/idx/status", isAuthenticated, async (_req, res) => {
    try {
      const configured = idxConfigured();
      const inProgress = isSyncInProgress();
      const last = await getLastSyncLog();
      const logs = await getSyncLogs(5);
      const idxCount = await storage.getPropertiesCount({ source: "idx" });
      res.json({ configured, inProgress, last, logs, idxCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Manually trigger a sync
  app.post("/api/idx/sync", isAuthenticated, async (_req, res) => {
    if (!idxConfigured()) {
      return res.status(400).json({
        message: "IDX not configured. Add IDX_BROKER_API_KEY (from your IDX Broker account dashboard) as an environment variable.",
      });
    }
    if (isSyncInProgress()) {
      return res.status(409).json({ message: "Sync already running. Check back in a moment." });
    }
    // Run async — respond immediately
    res.json({ message: "Sync started" });
    runIdxSync().catch(e => console.error("[IDX] Manual sync error:", e.message));
  });

  // Seed data function to be called on startup
  seedDatabase().catch(console.error);

  // Start scheduled IDX auto-sync (no-op if not configured)
  startIdxAutoSync();

  // === Notifications ===
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const unreadOnly = req.query.unread === "true";
      const archived = req.query.archived === "true";
      const result = await storage.getNotifications(userId, { unreadOnly, archived });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadCount(userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  async function trySendNotificationEmail(targetUserId: string, type: string, title: string, message: string, linkUrl?: string | null, propertyId?: number | null, conversationId?: number | null) {
    try {
      const configured = await isEmailConfigured();
      if (!configured) return;
      let prefs = await storage.getNotificationPreferences(targetUserId);
      if (!prefs) {
        prefs = await storage.upsertNotificationPreferences(targetUserId, {});
      }
      if (!prefs.emailEnabled) return;

      const typeToField: Record<string, keyof typeof prefs> = {
        new_listing: "emailNewListing",
        price_drop: "emailPriceDrop",
        open_house: "emailOpenHouse",
        agent_match: "emailAgentMatch",
        system: "emailSystem",
        message_received: "emailSystem",
        showing_request: "emailSystem",
        showing_confirmed: "emailSystem",
        showing_declined: "emailSystem",
        showing_update: "emailSystem",
        offer_response: "emailSystem",
      };
      const field = typeToField[type];
      if (!field) return;
      if (!prefs[field]) return;

      const today = new Date().toISOString().split("T")[0];
      const emailsToday = prefs.lastEmailResetDate === today ? prefs.emailsSentToday : 0;

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser?.email) return;

      let propertyCard = null;
      if (propertyId && (type === "new_listing" || type === "price_drop" || type === "open_house")) {
        try {
          const property = await storage.getProperty(propertyId);
          if (property) {
            const formatPrice = (p: number) => p >= 1000000 ? `$${(p / 1000000).toFixed(1)}M` : p >= 1000 ? `$${Math.round(p / 1000)}K` : `$${p}`;
            propertyCard = {
              address: property.title || `${property.addressStreetNumber || ""} ${property.addressStreetName || ""}`.trim(),
              price: formatPrice(property.price),
              beds: property.beds || undefined,
              baths: property.baths || undefined,
              sqft: property.sqft || undefined,
              imageUrl: property.imageUrl || null,
              propertyType: property.propertyType || undefined,
            };
          }
        } catch { }
      }

      const result = await sendNotificationEmail({
        to: targetUser.email,
        recipientName: targetUser.firstName || targetUser.email,
        type, title, message, linkUrl,
        propertyId: propertyId ?? null,
        conversationId: conversationId ?? null,
        propertyCard,
        userId: targetUserId,
        emailsSentToday: emailsToday,
      });

      if (result.sent) {
        await storage.incrementEmailCount(targetUserId);
      }
    } catch (err) {
      console.error("[Email] Background email send failed:", err);
    }
  }

  const createNotificationSchema = z.object({
    targetUserId: z.string().min(1),
    type: z.enum(["new_listing", "price_drop", "agent_match", "open_house", "system"]),
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    propertyId: z.number().int().positive().nullable().optional(),
    linkUrl: z.string().max(500).nullable().optional(),
    metadata: z.any().nullable().optional(),
  });

  async function shouldDeliverInApp(targetUserId: string, type: string): Promise<boolean> {
    try {
      let prefs = await storage.getNotificationPreferences(targetUserId);
      if (!prefs) {
        prefs = await storage.upsertNotificationPreferences(targetUserId, {});
      }
      if (!prefs.inAppEnabled) return false;
      const typeToField: Record<string, keyof typeof prefs> = {
        new_listing: "inAppNewListing",
        price_drop: "inAppPriceDrop",
        open_house: "inAppOpenHouse",
        agent_match: "inAppAgentMatch",
        system: "inAppSystem",
      };
      const field = typeToField[type];
      if (field && prefs[field] === false) return false;
      return true;
    } catch {
      return true;
    }
  }

  app.post("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user?.email === process.env.ADMIN_EMAIL;
      if (!isAdminUser) return res.status(403).json({ error: "Admin only" });
      const parsed = createNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { targetUserId, type, title, message, propertyId, linkUrl, metadata } = parsed.data;
      const deliverInApp = await shouldDeliverInApp(targetUserId, type);
      let notification = null;
      if (deliverInApp) {
        notification = await storage.createNotification({
          userId: targetUserId, type, title, message,
          propertyId: propertyId || null, linkUrl: linkUrl || null,
          metadata: metadata || null, read: false, archived: false,
        });
      }
      trySendNotificationEmail(targetUserId, type, title, message, linkUrl, propertyId);
      res.json(notification || { skipped: true, reason: "in-app delivery disabled" });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/notifications/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sampleNotifications = [
        { type: "new_listing", title: "New Home Match!", message: "A new 3-bed home in Pacific Beach matching your saved search is now available at $1,250,000.", linkUrl: "/search?city=San+Diego", propertyId: null },
        { type: "price_drop", title: "Price Reduced", message: "A home you saved dropped from $899K to $849K — 5.6% price reduction.", linkUrl: "/dashboard", propertyId: null },
        { type: "agent_match", title: "New Buyer Interested", message: "A buyer has expressed interest in one of your listings through the swipe feed.", linkUrl: "/agent", propertyId: null },
        { type: "open_house", title: "Open House Tomorrow", message: "Reminder: Open house at 1234 Ocean Blvd, Pacific Beach tomorrow 1-4 PM.", linkUrl: "/search", propertyId: null },
        { type: "system", title: "Welcome to xucasa!", message: "Set up your profile and save searches to get notified about new homes.", linkUrl: "/dashboard", propertyId: null },
      ];
      const created = [];
      for (const n of sampleNotifications) {
        const deliverInApp = await shouldDeliverInApp(userId, n.type);
        if (deliverInApp) {
          const notification = await storage.createNotification({
            userId, type: n.type, title: n.title, message: n.message,
            propertyId: n.propertyId, linkUrl: n.linkUrl,
            read: false, archived: false, metadata: null,
          });
          created.push(notification);
        }
        trySendNotificationEmail(userId, n.type, n.title, n.message, n.linkUrl, n.propertyId);
      }
      res.json({ created: created.length, notifications: created });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const userId = req.user.claims.sub;
      const { read, archived } = req.body;
      if (archived === true) {
        const updated = await storage.archiveNotification(id, userId);
        if (!updated) return res.status(404).json({ error: "Notification not found" });
        return res.json(updated);
      }
      if (read === true) {
        const updated = await storage.markNotificationRead(id, userId);
        if (!updated) return res.status(404).json({ error: "Notification not found" });
        return res.json(updated);
      }
      res.status(400).json({ error: "No valid updates" });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteNotification(id, userId);
      if (!deleted) return res.status(404).json({ error: "Notification not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let prefs = await storage.getNotificationPreferences(userId);
      if (!prefs) {
        prefs = await storage.upsertNotificationPreferences(userId, {});
      }
      res.json(prefs);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const notificationPrefsUpdateSchema = z.object({
    emailEnabled: z.boolean().optional(),
    emailNewListing: z.boolean().optional(),
    emailPriceDrop: z.boolean().optional(),
    emailOpenHouse: z.boolean().optional(),
    emailAgentMatch: z.boolean().optional(),
    emailSystem: z.boolean().optional(),
    emailDigestFrequency: z.enum(["instant", "daily", "weekly"]).optional(),
    inAppEnabled: z.boolean().optional(),
    inAppNewListing: z.boolean().optional(),
    inAppPriceDrop: z.boolean().optional(),
    inAppOpenHouse: z.boolean().optional(),
    inAppAgentMatch: z.boolean().optional(),
    inAppSystem: z.boolean().optional(),
  }).refine(obj => Object.values(obj).some(v => v !== undefined), { message: "No valid fields to update" });

  app.patch("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = notificationPrefsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const updates: Record<string, any> = {};
      for (const [key, val] of Object.entries(parsed.data)) {
        if (val !== undefined) updates[key] = val;
      }
      const prefs = await storage.upsertNotificationPreferences(userId, updates);
      res.json(prefs);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/email-status", isAuthenticated, async (req: any, res) => {
    try {
      const configured = await isEmailConfigured();
      res.json({ configured });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const testEmailLimiter = new Map<string, number>();
  app.post("/api/test-email", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lastSent = testEmailLimiter.get(userId) || 0;
      if (Date.now() - lastSent < 60_000) {
        return res.status(429).json({ sent: false, reason: "Please wait at least 1 minute between test emails" });
      }
      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "No email on file" });
      const result = await sendTestEmail(user.email, user.firstName || user.email);
      if (result.sent) testEmailLimiter.set(userId, Date.now());
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/test-email", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user?.email === process.env.ADMIN_EMAIL;
      if (!isAdminUser) return res.status(403).json({ error: "Admin only" });
      const testEmailSchema = z.object({ to: z.string().email().optional() });
      const parsed = testEmailSchema.safeParse(req.body);
      const targetEmail = parsed.success && parsed.data.to ? parsed.data.to : user!.email;
      const result = await sendTestEmail(targetEmail!, user?.firstName || targetEmail!);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // === Error Reporting (public endpoint with simple rate limiting) ===
  const errorReportLimiter = new Map<string, { count: number; resetAt: number }>();
  app.post("/api/error-reports", async (req, res) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const limit = errorReportLimiter.get(ip);
    if (limit && limit.resetAt > now) {
      if (limit.count >= 20) {
        return res.status(429).json({ error: "Too many reports" });
      }
      limit.count++;
    } else {
      errorReportLimiter.set(ip, { count: 1, resetAt: now + 60000 });
    }
    try {
      const { type, message, stack, componentStack, url, userAgent, userId, sessionId, breadcrumbs, metadata } = req.body;
      if (!type || !message) {
        return res.status(400).json({ error: "type and message are required" });
      }
      const existing = await storage.incrementErrorOccurrence(message, url);
      if (existing) {
        return res.json({ id: existing.id, deduplicated: true });
      }
      const report = await storage.createErrorReport({
        type: String(type).slice(0, 100),
        message: String(message).slice(0, 2000),
        stack: stack ? String(stack).slice(0, 5000) : null,
        componentStack: componentStack ? String(componentStack).slice(0, 3000) : null,
        url: url ? String(url).slice(0, 500) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        userId: userId ? String(userId).slice(0, 100) : null,
        sessionId: sessionId ? String(sessionId).slice(0, 100) : null,
        breadcrumbs: breadcrumbs || null,
        metadata: metadata || null,
        status: "new",
        resolved: false,
        occurrences: 1,
      });
      res.json({ id: report.id });
    } catch (err) {
      console.error("[Error Report] Failed to save:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // === Admin Error Report endpoints (admin-only) ===
  app.get("/api/admin/error-reports", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const status = (_req as any).query.status as string | undefined;
      const resolved = (_req as any).query.resolved === "true" ? true : (_req as any).query.resolved === "false" ? false : undefined;
      const reports = await storage.getErrorReports({ status, resolved });
      res.json(reports);
    } catch (err) {
      console.error("[Admin Error Reports] Failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  let archiveLock = false;
  app.post("/api/admin/error-reports/archive", isAuthenticated, isAdmin, async (_req, res) => {
    if (archiveLock) return res.status(409).json({ error: "Archive operation already in progress" });
    archiveLock = true;
    try {
      const resolved = await storage.getErrorReports({ resolved: true });
      if (resolved.length === 0) { archiveLock = false; return res.status(400).json({ error: "No resolved errors to archive" }); }

      const resolvedIds = resolved.map(r => r.id);
      await db.transaction(async (tx) => {
        for (const id of resolvedIds) {
          await tx.delete(errorReports).where(eq(errorReports.id, id));
        }
      });

      let existing: any[] = [];
      if (fs.existsSync(ERROR_ARCHIVE_PATH)) {
        try {
          existing = JSON.parse(fs.readFileSync(ERROR_ARCHIVE_PATH, "utf-8"));
        } catch { existing = []; }
      }

      const batch = {
        archivedAt: new Date().toISOString(),
        count: resolved.length,
        reports: resolved,
      };
      existing.push(batch);

      fs.mkdirSync(path.dirname(ERROR_ARCHIVE_PATH), { recursive: true });
      fs.writeFileSync(ERROR_ARCHIVE_PATH, JSON.stringify(existing, null, 2));

      archiveLock = false;
      res.json({ archived: resolved.length, totalBatches: existing.length, path: "data/error-archive.json" });
    } catch (err) {
      archiveLock = false;
      console.error("[Archive Errors] Failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/error-reports/archive", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      if (!fs.existsSync(ERROR_ARCHIVE_PATH)) return res.json([]);
      const data = JSON.parse(fs.readFileSync(ERROR_ARCHIVE_PATH, "utf-8"));
      res.json(data);
    } catch (err) {
      console.error("[Archive Read] Failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/error-reports/archive/download", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      if (!fs.existsSync(ERROR_ARCHIVE_PATH)) return res.status(404).json({ error: "No archive file exists" });
      res.setHeader("Content-Disposition", "attachment; filename=error-archive.json");
      res.setHeader("Content-Type", "application/json");
      fs.createReadStream(ERROR_ARCHIVE_PATH).pipe(res);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/error-reports/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const report = await storage.getErrorReport(id);
      if (!report) return res.status(404).json({ error: "Not found" });
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admin/error-reports/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const { status, adminNotes, resolved } = req.body;
      const validStatuses = ["new", "investigating", "resolved", "ignored"];
      const updates: any = {};
      if (status && validStatuses.includes(status)) updates.status = status;
      if (typeof adminNotes === "string") updates.adminNotes = adminNotes.slice(0, 2000);
      if (typeof resolved === "boolean") updates.resolved = resolved;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid updates" });
      const updated = await storage.updateErrorReport(id, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/error-reports/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      await db.delete(errorReports).where(eq(errorReports.id, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Buyer Interest API ────────────────────────────────────────────────────

  app.post("/api/buyer-interest", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { propertyId, source } = req.body;
      if (!propertyId) return res.status(400).json({ message: "propertyId required" });
      const result = await storage.upsertBuyerInterest(propertyId, userId, source || "swipe");
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/buyer-interest", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const role = req.query.role;
      if (role === "agent") {
        const interests = await storage.getBuyerInterestForAgent(userId);
        res.json(interests);
      } else {
        const interests = await storage.getBuyerInterestForBuyer(userId);
        res.json(interests);
      }
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/buyer-interest/agent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interests = await storage.getBuyerInterestForAgent(userId);
      res.json(interests);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/buyer-interest/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interests = await storage.getBuyerInterestForBuyer(userId);
      res.json(interests);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/buyer-interest/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { stage } = req.body;

      const existing = await db.select().from(buyerInterest).where(eq(buyerInterest.id, id)).limit(1);
      if (!existing.length) return res.status(404).json({ message: "Not found" });

      const prop = await storage.getProperty(existing[0].propertyId);
      const isAgent = prop?.agentId === userId;
      if (!isAgent && existing[0].buyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validStages = ["new", "engaged", "showing", "offer", "closed", "archived"];
      if (stage && !validStages.includes(stage)) {
        return res.status(400).json({ message: `Invalid stage. Must be one of: ${validStages.join(", ")}` });
      }

      const updates: any = { updatedAt: new Date() };
      if (stage) updates.stage = stage;

      const [updated] = await db.update(buyerInterest).set(updates).where(eq(buyerInterest.id, id)).returning();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── Conversations API ───────────────────────────────────────────────────

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const convos = await storage.getConversationsForUser(userId);
      res.json(convos);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/conversations/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const convos = await storage.getConversationsForUser(userId);
      const total = convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      res.json({ unreadCount: total });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const convo = await storage.getConversation(parseInt(req.params.id));
      if (!convo) return res.status(404).json({ message: "Conversation not found" });
      if (convo.buyerUserId !== userId && convo.agentUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(convo);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { propertyId, agentUserId, buyerUserId, initialMessage, type } = req.body;
      if (!propertyId) return res.status(400).json({ message: "propertyId required" });

      const prop = await storage.getProperty(propertyId);
      if (!prop) return res.status(404).json({ message: "Property not found" });

      const callerUser = await storage.getUser(userId);
      const isAgent = callerUser?.role === "agent";

      let resolvedBuyerId: string;
      let resolvedAgentId: string;

      if (isAgent) {
        if (prop.agentId !== userId) {
          return res.status(403).json({ message: "You are not the listing agent for this property" });
        }
        if (!buyerUserId) {
          return res.status(400).json({ message: "buyerUserId required when agent creates conversation" });
        }
        resolvedAgentId = userId;
        resolvedBuyerId = buyerUserId;
      } else {
        resolvedBuyerId = userId;
        resolvedAgentId = prop.agentId || agentUserId;
        if (!resolvedAgentId) return res.status(400).json({ message: "No agent associated with this property" });
        if (agentUserId && agentUserId !== prop.agentId) {
          return res.status(403).json({ message: "Invalid agent for this property" });
        }
      }

      await storage.upsertBuyerInterest(propertyId, resolvedBuyerId, type || "inquiry");

      const convo = await storage.getOrCreateConversation(propertyId, resolvedBuyerId, resolvedAgentId, isAgent ? "agent" : "buyer");

      if (initialMessage) {
        await storage.createMessage({
          conversationId: convo.id,
          senderUserId: userId,
          type: type || "text",
          content: initialMessage,
        });

        const recipientId = isAgent ? resolvedBuyerId : resolvedAgentId;
        const recipient = await storage.getUser(recipientId);
        if (recipient?.email) {
          const senderName = callerUser?.firstName ? `${callerUser.firstName} ${callerUser.lastName || ""}`.trim() : (isAgent ? "Your agent" : "A buyer");
          await storage.createNotification({
            userId: recipientId,
            type: "message_received",
            title: `New message from ${senderName}`,
            message: initialMessage.substring(0, 200),
            propertyId,
            linkUrl: `/conversations/${convo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(recipientId, "message_received", `New message from ${senderName}`, initialMessage.substring(0, 200), `/conversations/${convo.id}`, propertyId, convo.id);
        }
      }

      res.status(201).json(convo);
    } catch (err) {
      console.error("Create conversation error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/conversations/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      const convo = await storage.getConversation(conversationId);
      if (!convo) return res.status(404).json({ message: "Conversation not found" });
      if (convo.buyerUserId !== userId && convo.agentUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const role = convo.buyerUserId === userId ? 'buyer' : 'agent';
      await storage.updateConversationReadAt(conversationId, userId, role);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── Messages API ────────────────────────────────────────────────────────

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      const convo = await storage.getConversation(conversationId);
      if (!convo) return res.status(404).json({ message: "Conversation not found" });
      if (convo.buyerUserId !== userId && convo.agentUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      const msgs = await storage.getMessagesForConversation(conversationId, limit, before);

      const role = convo.buyerUserId === userId ? 'buyer' : 'agent';
      await storage.updateConversationReadAt(conversationId, userId, role);

      res.json(msgs);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      const convo = await storage.getConversation(conversationId);
      if (!convo) return res.status(404).json({ message: "Conversation not found" });
      if (convo.buyerUserId !== userId && convo.agentUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { content, type } = req.body;
      if (!content) return res.status(400).json({ message: "content required" });

      const msg = await storage.createMessage({
        conversationId,
        senderUserId: userId,
        type: type || "text",
        content,
      });

      const role = convo.buyerUserId === userId ? 'buyer' : 'agent';
      await storage.updateConversationReadAt(conversationId, userId, role);

      const recipientId = convo.buyerUserId === userId ? convo.agentUserId : convo.buyerUserId;
      const sender = await storage.getUser(userId);
      const senderName = sender?.firstName ? `${sender.firstName} ${sender.lastName || ""}`.trim() : "Someone";
      await storage.createNotification({
        userId: recipientId,
        type: "message_received",
        title: `New message from ${senderName}`,
        message: content.substring(0, 200),
        propertyId: convo.propertyId,
        linkUrl: `/conversations/${conversationId}`,
        read: false,
        archived: false,
      });
      trySendNotificationEmail(recipientId, "message_received", `New message from ${senderName}`, content.substring(0, 200), `/conversations/${conversationId}`, convo.propertyId, conversationId);

      const msgWithSender = { ...msg, sender };
      res.status(201).json(msgWithSender);
    } catch (err) {
      console.error("Send message error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── Showing Requests API ────────────────────────────────────────────────

  app.get("/api/showing-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getShowingRequestsForUser(userId);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/showing-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { propertyId, requestedDates, notes } = req.body;
      if (!propertyId || !requestedDates || !Array.isArray(requestedDates) || requestedDates.length === 0) {
        return res.status(400).json({ message: "propertyId and requestedDates required" });
      }

      const prop = await storage.getProperty(propertyId);
      if (!prop) return res.status(404).json({ message: "Property not found" });

      const agentId = prop.agentId;
      if (!agentId) return res.status(400).json({ message: "No agent for this property" });

      await storage.upsertBuyerInterest(propertyId, userId, "showing_request");

      const convo = await storage.getOrCreateConversation(propertyId, userId, agentId);

      const request = await storage.createShowingRequest({
        conversationId: convo.id,
        propertyId,
        buyerUserId: userId,
        agentUserId: agentId,
        requestedDates,
        notes: notes || null,
      });

      const buyer = await storage.getUser(userId);
      const buyerName = buyer?.firstName ? `${buyer.firstName} ${buyer.lastName || ""}`.trim() : "A buyer";
      const dateStr = requestedDates.slice(0, 2).join(", ");
      await storage.createMessage({
        conversationId: convo.id,
        senderUserId: userId,
        type: "showing_request",
        content: `Showing request for ${dateStr}${notes ? ` — ${notes}` : ""}`,
        metadata: { showingRequestId: request.id, requestedDates },
      });

      await storage.createNotification({
        userId: agentId,
        type: "showing_request",
        title: `Showing request from ${buyerName}`,
        message: `Requested dates: ${dateStr}`,
        propertyId,
        linkUrl: `/conversations/${convo.id}`,
        read: false,
        archived: false,
      });
      trySendNotificationEmail(agentId, "showing_request", `Showing request from ${buyerName}`, `Requested dates: ${dateStr}`, `/conversations/${convo.id}`, propertyId, convo.id);

      res.status(201).json(request);
    } catch (err) {
      console.error("Create showing request error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/showing-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { status, confirmedDate } = req.body;
      if (!status) return res.status(400).json({ message: "status required" });

      const existing = await storage.getShowingRequest(id);
      if (!existing) return res.status(404).json({ message: "Showing request not found" });
      if (existing.buyerUserId !== userId && existing.agentUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const isAgent = existing.agentUserId === userId;
      const isBuyer = existing.buyerUserId === userId;
      const agentAllowed = ["confirmed", "declined", "rescheduled"];
      const buyerAllowed = ["cancelled"];
      if (isAgent && !agentAllowed.includes(status)) {
        return res.status(403).json({ message: `Agents can only set status to: ${agentAllowed.join(", ")}` });
      }
      if (isBuyer && !buyerAllowed.includes(status)) {
        return res.status(403).json({ message: `Buyers can only cancel showing requests` });
      }

      const updated = await storage.updateShowingRequestStatus(
        id,
        status,
        confirmedDate ? new Date(confirmedDate) : undefined,
      );

      if (status === "confirmed") {
        const now = new Date();
        await db.update(buyerInterest)
          .set({ stage: "showing", lastActivityAt: now, updatedAt: now })
          .where(and(eq(buyerInterest.propertyId, updated.propertyId), eq(buyerInterest.buyerUserId, updated.buyerUserId)));
      }

      if (updated.conversationId) {
        const statusMsg = status === "confirmed"
          ? `Showing confirmed${confirmedDate ? ` for ${new Date(confirmedDate).toLocaleDateString()}` : ""}`
          : `Showing ${status}`;
        await storage.createMessage({
          conversationId: updated.conversationId,
          senderUserId: userId,
          type: "system",
          content: statusMsg,
        });
      }

      const recipientId = updated.buyerUserId === userId ? updated.agentUserId : updated.buyerUserId;
      const sender = await storage.getUser(userId);
      const senderName = sender?.firstName || "Agent";
      const statusLabel = status === "confirmed" ? "confirmed" : status === "declined" ? "declined" : status === "cancelled" ? "cancelled" : status;
      const notificationType = status === "confirmed" ? "showing_confirmed" : status === "declined" ? "showing_declined" : "showing_update";
      const showingNotifTitle = `Showing ${statusLabel} by ${senderName}`;
      const showingNotifMsg = confirmedDate ? `Confirmed for ${new Date(confirmedDate).toLocaleDateString()}` : `Showing has been ${statusLabel}`;
      await storage.createNotification({
        userId: recipientId,
        type: notificationType,
        title: showingNotifTitle,
        message: showingNotifMsg,
        propertyId: updated.propertyId,
        linkUrl: `/conversations/${updated.conversationId}`,
        read: false,
        archived: false,
      });
      trySendNotificationEmail(recipientId, notificationType, showingNotifTitle, showingNotifMsg, `/conversations/${updated.conversationId}`, updated.propertyId, updated.conversationId);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return httpServer;
}

async function seedDatabase() {
  const existingCount = await storage.getPropertiesCount();

  // Backfill address fields for seed properties that have null addresses
  const addressMap: Record<number, { addressStreetNumber: string; addressStreetName: string; addressCity: string; addressState: string; addressZip: string }> = {
    1: { addressStreetNumber: "123", addressStreetName: "Market St", addressCity: "San Francisco", addressState: "CA", addressZip: "94103" },
    2: { addressStreetNumber: "456", addressStreetName: "Oak Ave", addressCity: "San Mateo", addressState: "CA", addressZip: "94401" },
    3: { addressStreetNumber: "789", addressStreetName: "Mission St", addressCity: "San Francisco", addressState: "CA", addressZip: "94103" },
    4: { addressStreetNumber: "101", addressStreetName: "University Ave", addressCity: "Palo Alto", addressState: "CA", addressZip: "94301" },
  };
  for (const [idStr, addr] of Object.entries(addressMap)) {
    const prop = await storage.getProperty(Number(idStr));
    if (prop && !prop.addressCity) {
      await storage.updateProperty(prop.id, addr);
    }
  }

  if (existingCount === 0) {
    await storage.createProperty({
      title: "Beautiful Modern Home",
      description: "A stunning modern home in the heart of the city with open concept living.",
      price: 1250000,
      addressStreetNumber: "123",
      addressStreetName: "Market St",
      addressCity: "San Francisco",
      addressState: "CA",
      addressZip: "94103",
      location: "San Francisco, CA",
      beds: 3,
      baths: "2.5",
      sqft: 2100,
      lotSize: 4500,
      hoaFee: 0,
      isOffMarket: false,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
      photos: [
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=800",
      ],
    });
    
    await storage.createProperty({
      title: "Cozy Suburb Craftsman",
      description: "Charming craftsman style home with a large backyard and recent updates.",
      price: 850000,
      addressStreetNumber: "456",
      addressStreetName: "Oak Ave",
      addressCity: "San Mateo",
      addressState: "CA",
      addressZip: "94401",
      location: "San Mateo, CA",
      beds: 4,
      baths: "2.0",
      sqft: 1800,
      lotSize: 6000,
      hoaFee: 0,
      isOffMarket: false,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
    });

    await storage.createProperty({
      title: "Downtown Luxury Condo",
      description: "High-rise luxury condo with panoramic city views and top-tier amenities.",
      price: 950000,
      addressStreetNumber: "789",
      addressStreetName: "Mission St",
      addressUnitNumber: "1201",
      addressCity: "San Francisco",
      addressState: "CA",
      addressZip: "94103",
      location: "San Francisco, CA",
      beds: 2,
      baths: "2.0",
      sqft: 1200,
      lotSize: 0,
      hoaFee: 850,
      isOffMarket: false,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
    });

    await storage.createProperty({
      title: "Exclusive Off-Market Estate",
      description: "Make me move! This incredible estate is available for the right price.",
      price: 3500000,
      addressStreetNumber: "101",
      addressStreetName: "University Ave",
      addressCity: "Palo Alto",
      addressState: "CA",
      addressZip: "94301",
      location: "Palo Alto, CA",
      beds: 5,
      baths: "4.5",
      sqft: 4500,
      lotSize: 12000,
      hoaFee: 0,
      isOffMarket: true,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=800",
    });
  }
}
