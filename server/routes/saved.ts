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

router.get(api.savedProperties.list.path, isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const saved = await storage.getSavedProperties(user.sub);
    res.status(200).json(saved.map(s => ({ ...s, property: stripConfidentialFields(s.property) })));
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post(api.savedProperties.create.path, isAuthenticated, async (req: any, res) => {
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

router.delete(api.savedProperties.delete.path, isAuthenticated, async (req: any, res) => {
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

router.patch("/api/saved-properties/:propertyId/list", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = z.object({ listId: z.number().int().positive().nullable().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
    await storage.movePropertyToList(user.sub, propertyId, parsed.data.listId ?? null);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/favorite-lists", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const lists = await storage.getFavoriteLists(user.sub);
    res.status(200).json(lists);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/favorite-lists", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "List name is required and must be under 100 characters", errors: parsed.error.flatten() });
    const list = await storage.createFavoriteList(user.sub, parsed.data.name);
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/api/favorite-lists/:id", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "List name is required", errors: parsed.error.flatten() });
    const list = await storage.renameFavoriteList(id, user.sub, parsed.data.name);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/api/favorite-lists/:id", isAuthenticated, async (req: any, res) => {
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

router.get(api.savedSearches.list.path, isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const searches = await storage.getSavedSearches(user.sub);
    res.status(200).json(searches);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post(api.savedSearches.create.path, isAuthenticated, async (req: any, res) => {
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

router.delete(api.savedSearches.delete.path, isAuthenticated, async (req: any, res) => {
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

router.patch("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user.claims;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = z.object({ name: z.string().trim().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Name is required", errors: parsed.error.flatten() });
    await storage.renameSavedSearch(id, user.sub, parsed.data.name);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/search-history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const history = await storage.getSearchHistory(userId);
    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/search-history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const parsed = z.object({ query: z.string().min(1).max(500), criteria: z.any().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "query required", errors: parsed.error.flatten() });
    const entry = await storage.addSearchHistory(userId, parsed.data.query, parsed.data.criteria || {});
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/api/search-history/:id", isAuthenticated, async (req: any, res) => {
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

router.delete("/api/search-history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    await storage.clearSearchHistory(userId);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
