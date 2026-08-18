import { Router } from "express";
  import fs from "fs";
  import path from "path";
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

router.get("/api/concessions/active", async (_req, res) => {
  try {
    const rows = await db.select().from(sellerConcessions)
      .where(eq(sellerConcessions.isActive, true));
    res.json({ concessions: rows });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/properties/:id/concessions", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (!Number.isFinite(propertyId)) return res.status(400).json({ message: "Invalid id" });
    const rows = await db.select().from(sellerConcessions)
      .where(and(eq(sellerConcessions.propertyId, propertyId), eq(sellerConcessions.isActive, true)))
      .orderBy(desc(sellerConcessions.createdAt))
      .limit(1);
    res.json({ concession: rows[0] || null });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/properties/:id/concessions", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const propertyId = parseInt(req.params.id);
  if (!Number.isFinite(propertyId)) return res.status(400).json({ message: "Invalid id" });

  try {
    const property = await storage.getProperty(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const caller = await storage.getUser(userId);
    if (!caller) return res.status(401).json({ message: "Unauthorized" });

    const isVerifiedAgent = caller.role === "agent" && caller.agentVerified === true;
    const isAdmin = caller.role === "admin";
    const isListingAgent = property.agentId === userId;

    if (!isAdmin && !(isVerifiedAgent && isListingAgent)) {
      return res.status(403).json({
        message: "Only the verified listing agent (or an admin) can post seller terms for this property",
      });
    }

    const parsed = insertSellerConcessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid concession data", errors: parsed.error.flatten() });
    }

    const result = await executeWithAudit(
      { req, event: "seller_concession_created", userId, propertyId },
      async () => {
        // Atomic supersede: deactivate previous + insert new in a single transaction
        const created = await db.transaction(async (tx) => {
          await tx.update(sellerConcessions)
            .set({ isActive: false, updatedAt: new Date() })
            .where(and(eq(sellerConcessions.propertyId, propertyId), eq(sellerConcessions.isActive, true)));

          const [row] = await tx.insert(sellerConcessions).values({
            ...parsed.data,
            propertyId,
            postedByUserId: userId,
            postedByRole: isAdmin ? "admin" : "agent",
            isActive: true,
          }).returning();
          return row;
        });

        return { data: created, auditOverrides: { resourceType: "seller_concession", resourceId: String(created.id) } };
      }
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/api/properties/:id/concessions", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const propertyId = parseInt(req.params.id);
  if (!Number.isFinite(propertyId)) return res.status(400).json({ message: "Invalid id" });

  try {
    const caller = await storage.getUser(userId);
    const isAdmin = caller?.role === "admin";

    const rows = await db.select().from(sellerConcessions)
      .where(and(eq(sellerConcessions.propertyId, propertyId), eq(sellerConcessions.isActive, true)))
      .limit(1);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ message: "No active concession" });

    if (existing.postedByUserId !== userId && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await executeWithAudit(
      { req, event: "seller_concession_deleted", userId, propertyId, metadata: { concessionId: existing.id } },
      async () => {
        await db.update(sellerConcessions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(sellerConcessions.id, existing.id));
        return { data: { id: existing.id } };
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
