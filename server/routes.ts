import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { buyerMatches, buyerProfiles, users } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";
import { getPublicRecords } from "./publicRecords";
import { getZoningData } from "./zoningData";
import { runIdxSync, isSyncInProgress, idxConfigured, getLastSyncLog, getSyncLogs, startIdxAutoSync } from "./idxSync";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register auth routes first
  registerAuthRoutes(app);

  // Backfill missing lat/lng for all existing properties (runs once on startup)
  (async () => {
    try {
      const { geocodeAddress } = await import("./publicRecords");
      const allProps = await storage.getProperties();
      const needsGeo = allProps.filter(p => !p.lat || !p.lng);
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
      const props = await storage.getProperties(filters);
      res.status(200).json(props);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/properties/mine", isAuthenticated, async (req, res) => {
    try {
      const allProps = await storage.getProperties();
      const mine = allProps.filter(p => p.agentId === req.user!.claims.sub);
      res.json(mine);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get(api.properties.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    
    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    
    res.status(200).json(prop);
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

  // Saved Properties API
  app.get(api.savedProperties.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const saved = await storage.getSavedProperties(user.sub);
      res.status(200).json(saved);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.savedProperties.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.savedProperties.create.input.parse(req.body);
      const saved = await storage.saveProperty(user.sub, input.propertyId);
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

  // Profile update
  app.patch("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const userId = req.user.claims.sub;
      const { firstName, lastName } = req.body;
      const updated = await authStorage.updateUser(userId, { firstName, lastName });
      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update profile" });
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
      const { nickname, addressStreetNumber, addressStreetName, addressUnitNumber, addressCity, addressState, addressZip, notes } = req.body;
      if (!nickname) return res.status(400).json({ message: "nickname required" });

      const home = await storage.createUserHome(userId, {
        nickname, addressStreetNumber, addressStreetName, addressUnitNumber,
        addressCity, addressState, addressZip, notes, userId,
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
      res.json(saved);
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
      const lead = req.body;
      if (!lead.name || !lead.email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      const newLead = await storage.createSellLead(lead);
      res.status(201).json(newLead);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Seller Pitches ─────────────────────────────────────────────────────────

  const ADMIN_USER_ID = "55534280";

  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.user?.claims?.sub || req.user.claims.sub !== ADMIN_USER_ID) {
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
      const [pitches, leads, profiles, props] = await Promise.all([
        storage.getSellerPitches(),
        storage.getSellLeads(),
        storage.getBuyerProfiles(),
        storage.getProperties(),
      ]);
      res.json({
        totalPitches: pitches.length,
        newPitches: pitches.filter(p => p.status === "new").length,
        totalSellLeads: leads.length,
        totalBuyerProfiles: profiles.length,
        totalProperties: props.length,
      });
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
      res.json(referrals.map(r => ({ ...r.profile, user: r.user })));
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
      const parsed = insertBuyerMatchSchema.omit({ senderId: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      if (parsed.data.message) {
        const violation = checkFairHousing(parsed.data.message);
        if (violation) return res.status(400).json({ message: violation });
      }
      const data = { ...parsed.data, senderId: req.user!.claims.sub };
      const match = await storage.createBuyerMatch(data);
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
      const idxCount = await storage.getProperties().then(p => p.filter(x => x.source === "idx").length);
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

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProperties();

  // Backfill address fields for seed properties that have null addresses
  const addressMap: Record<number, { addressStreetNumber: string; addressStreetName: string; addressCity: string; addressState: string; addressZip: string }> = {
    1: { addressStreetNumber: "123", addressStreetName: "Market St", addressCity: "San Francisco", addressState: "CA", addressZip: "94103" },
    2: { addressStreetNumber: "456", addressStreetName: "Oak Ave", addressCity: "San Mateo", addressState: "CA", addressZip: "94401" },
    3: { addressStreetNumber: "789", addressStreetName: "Mission St", addressCity: "San Francisco", addressState: "CA", addressZip: "94103" },
    4: { addressStreetNumber: "101", addressStreetName: "University Ave", addressCity: "Palo Alto", addressState: "CA", addressZip: "94301" },
  };
  for (const prop of existing) {
    if (!prop.addressCity && addressMap[prop.id]) {
      await storage.updateProperty(prop.id, addressMap[prop.id]);
    }
  }

  if (existing.length === 0) {
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
