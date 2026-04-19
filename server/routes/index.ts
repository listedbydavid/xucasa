import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { registerAuthRoutes } from "../replit_integrations/auth";
import { seedDatabase } from "../lib/seedDatabase";

import propertiesRouter from "./properties";
import savedRouter from "./saved";
import onboardingRouter from "./onboarding";
import agentRouter from "./agent";
import homeownerRouter from "./homeowner";
import buyerRouter from "./buyer";
import offersRouter from "./offers";
import conversationsRouter from "./conversations";
import notificationsRouter from "./notifications";
import reviewsRouter from "./reviews";
import concessionsRouter from "./concessions";
import beaconRouter from "./beacon";
import marketplaceRouter from "./marketplace";
import idxRouter from "./idx";
import profileRouter from "./profile";
import errorsRouter from "./errors";
import adminRouter from "./admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register Replit auth routes first.
  registerAuthRoutes(app);

  // Backfill missing lat/lng for properties without coordinates (runs once on startup).
  (async () => {
    try {
      const { geocodeAddress } = await import("../publicRecords");
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

  // Mount all domain routers under /api. Each router defines its own absolute
  // /api/... paths (preserved from the original monolithic routes.ts).
  // Registration order matters when routes overlap (more-specific paths must
  // be on routers registered before catch-all routers).
  app.use(adminRouter);          // /api/admin/* — registered first to win over property/etc fallbacks
  app.use(concessionsRouter);    // /api/concessions/*, /api/properties/:id/concessions
  app.use(reviewsRouter);        // /api/properties/:id/reviews
  app.use(beaconRouter);         // /api/beacon/*
  app.use(marketplaceRouter);    // /api/buyer-matches/*, /api/seller-pitches/*
  app.use(idxRouter);            // /api/idx/*, /api/email-status, /api/test-email
  app.use(profileRouter);        // /api/profile/*, /api/auth/user PATCH
  app.use(errorsRouter);         // /api/error-reports/*
  app.use(notificationsRouter);  // /api/notifications/*
  app.use(conversationsRouter);  // /api/conversations/*, /api/messages/*, /api/showing-requests/*
  app.use(offersRouter);         // /api/property-offers/*, /api/swipe-notifications/*
  app.use(buyerRouter);          // /api/buyer-interest/*, /api/buyer-profile/*, /api/swipe-interest, /api/assigned-agent
  app.use(onboardingRouter);     // /api/onboarding/*
  app.use(agentRouter);          // /api/agent/*, /api/agent-invite, /api/agent-clients/*
  app.use(homeownerRouter);      // /api/home-report/*, /api/my-homes/*, /api/property-lookup
  app.use(savedRouter);          // /api/saved-properties/*, /api/favorite-lists/*, /api/saved-searches/*, /api/search-history
  app.use(propertiesRouter);     // /api/properties/* (catch-all — must be last among property-prefixed)

  // Seed the database in dev (skipped in production).
  if (process.env.NODE_ENV === "production") {
    console.warn("[Startup] seedDatabase() skipped — production environment");
  } else {
    seedDatabase().catch(console.error);
  }

  return httpServer;
}
