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

import { trySendNotificationEmail } from "../lib/notificationHelpers";

const createNotificationSchema = z.object({
  targetUserId: z.string().min(1),
  type: z.enum(["new_listing", "price_drop", "agent_match", "open_house", "system"]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  propertyId: z.number().int().positive().nullable().optional(),
  linkUrl: z.string().max(500).nullable().optional(),
  metadata: z.any().nullable().optional(),
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

router.get("/api/notifications", isAuthenticated, async (req: any, res) => {
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

router.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const count = await storage.getUnreadCount(userId);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/notifications", isAuthenticated, async (req: any, res) => {
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

router.post("/api/notifications/test", isAuthenticated, async (req: any, res) => {
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

router.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const userId = req.user.claims.sub;
    const parsedBody = z.object({ read: z.boolean().optional(), archived: z.boolean().optional() }).safeParse(req.body);
    if (!parsedBody.success) return res.status(400).json({ error: "Invalid request", errors: parsedBody.error.flatten() });
    const { read, archived } = parsedBody.data;
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

router.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
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

router.get("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
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

router.patch("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
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

export default router;
