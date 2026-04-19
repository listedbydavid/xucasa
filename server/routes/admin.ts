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

router.get("/api/admin/seller-pitches", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const pitches = await storage.getSellerPitches();
    res.json(pitches);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/seller-pitches/:id", isAuthenticated, isAdmin, async (req, res) => {
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

router.patch("/api/admin/seller-pitches/:id", isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const { status, adminNotes } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required" });
    const updated = await storage.updateSellerPitchStatus(id, status, adminNotes);
    await audit({ req, event: "admin_seller_pitch_updated", outcome: "success", userId: req.user?.claims?.sub, metadata: { pitchId: id, status } });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/sell-leads", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const leads = await storage.getSellLeads();
    res.json(leads);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
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

router.get("/api/admin/swipe-notifications", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const notifications = await storage.getAdminSwipeNotifications();
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/conversations", isAuthenticated, isAdmin, async (req: any, res) => {
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

router.get("/api/admin/conversations/:id", isAuthenticated, isAdmin, async (req: any, res) => {
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

router.get("/api/admin/property-offers", isAuthenticated, isAdmin, async (_req, res) => {
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

router.get("/api/admin/buyer-pitches", isAuthenticated, isAdmin, async (_req, res) => {
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

router.get("/api/admin/buyer-referrals", isAuthenticated, isAdmin, async (_req, res) => {
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

router.get("/api/admin/seller-referrals", isAuthenticated, isAdmin, async (_req, res) => {
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

router.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const allUsers = await authStorage.getAllUsers();
    const excludeTest = req.query.excludeTest === "true";
    const filtered = excludeTest
      ? allUsers.filter((u) => !u.accountSource || u.accountSource === "real")
      : allUsers;
    const usersWithActivity = await Promise.all(
      filtered.map(async (u) => {
        const activity = await authStorage.getUserActivity(u.id);
        return { ...u, activity };
      })
    );
    res.json(usersWithActivity);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await authStorage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const activity = await authStorage.getUserActivity(req.params.id);
    res.json({ ...user, activity });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
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
    await audit({ req, event: "admin_user_updated", outcome: "success", userId: (req as any).user?.claims?.sub, metadata: { targetUserId: req.params.id, updates: Object.keys(updates) } });
    res.json(updated);
  } catch (err: any) {
    await audit({ req, event: "admin_user_updated", outcome: "failure", userId: (req as any).user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
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
    await audit({ req, event: "admin_user_deleted", outcome: "success", userId: adminSub, metadata: { targetUserId: targetId, targetEmail: existing.email } });
    res.json({ message: "User deleted" });
  } catch (err: any) {
    await audit({ req, event: "admin_user_deleted", outcome: "failure", userId: (req as any).user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/cleanup/list", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const suspicious = await listSuspiciousAccounts();
    res.json(suspicious);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/cleanup/disable", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const schema = z.object({
      userIds: z.array(z.string()).min(1),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const result = await bulkDisable(parsed.data.userIds, parsed.data.reason);
    await audit({ req, event: "admin_bulk_disable", outcome: "success", userId: (req as any).user?.claims?.sub, metadata: { count: parsed.data.userIds.length, reason: parsed.data.reason } });
    res.json(result);
  } catch (err: any) {
    await audit({ req, event: "admin_bulk_disable", outcome: "failure", userId: (req as any).user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/cleanup/delete", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const schema = z.object({
      userIds: z.array(z.string()).min(1),
      confirm: z.literal(true, { errorMap: () => ({ message: "confirm must be true" }) }),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const result = await bulkDelete(parsed.data.userIds, { confirm: parsed.data.confirm });
    await audit({ req, event: "admin_bulk_delete", outcome: "success", userId: (req as any).user?.claims?.sub, metadata: { count: parsed.data.userIds.length } });
    res.json(result);
  } catch (err: any) {
    await audit({ req, event: "admin_bulk_delete", outcome: "failure", userId: (req as any).user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/test-email", isAuthenticated, async (req: any, res) => {
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

router.get("/api/admin/error-reports", isAuthenticated, isAdmin, async (_req, res) => {
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
router.post("/api/admin/error-reports/archive", isAuthenticated, isAdmin, async (_req, res) => {
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

    await audit({ req, event: "admin_error_archive", outcome: "success", userId: (_req as any).user?.claims?.sub, metadata: { count: resolved.length } });
    archiveLock = false;
    res.json({ archived: resolved.length, totalBatches: existing.length, path: "data/error-archive.json" });
  } catch (err: any) {
    await audit({ req: _req, event: "admin_error_archive", outcome: "failure", userId: (_req as any).user?.claims?.sub, errorMessage: err.message });
    archiveLock = false;
    console.error("[Archive Errors] Failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/error-reports/archive", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    if (!fs.existsSync(ERROR_ARCHIVE_PATH)) return res.json([]);
    const data = JSON.parse(fs.readFileSync(ERROR_ARCHIVE_PATH, "utf-8"));
    res.json(data);
  } catch (err) {
    console.error("[Archive Read] Failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/error-reports/archive/download", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    if (!fs.existsSync(ERROR_ARCHIVE_PATH)) return res.status(404).json({ error: "No archive file exists" });
    res.setHeader("Content-Disposition", "attachment; filename=error-archive.json");
    res.setHeader("Content-Type", "application/json");
    fs.createReadStream(ERROR_ARCHIVE_PATH).pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/error-reports/:id", isAuthenticated, isAdmin, async (req, res) => {
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

router.patch("/api/admin/error-reports/:id", isAuthenticated, isAdmin, async (req, res) => {
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

router.delete("/api/admin/error-reports/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await db.delete(errorReports).where(eq(errorReports.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/audit-events", isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const eventType = req.query.eventType as string | undefined;
    const outcome = req.query.outcome as string | undefined;
    const events = await storage.getRecentAuditEvents(limit, {
      eventType: eventType || undefined,
      outcome: outcome || undefined,
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: (req as any).requestId });
  }
});

router.get("/api/admin/audit-events/failures", isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await storage.getRecentAuditEvents(limit, { outcome: "failure" });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: (req as any).requestId });
  }
});

router.get("/api/admin/audit-events/stats", isAuthenticated, isAdmin, async (_req: any, res) => {
  try {
    const { auditEvents } = await import("@shared/schema");
    const totalCount = await db.select({ count: count() }).from(auditEvents);
    const failureCount = await db.select({ count: count() }).from(auditEvents).where(eq(auditEvents.outcome, "failure"));
    const recentEvents = await storage.getRecentAuditEvents(10);
    const recentFailures = await storage.getRecentAuditEvents(10, { outcome: "failure" });
    res.json({
      totalEvents: totalCount[0]?.count || 0,
      totalFailures: failureCount[0]?.count || 0,
      recentEvents,
      recentFailures,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
