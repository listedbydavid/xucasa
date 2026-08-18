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

router.patch("/api/auth/user", isAuthenticated, async (req: any, res) => {
  try {
    const { authStorage } = await import("../replit_integrations/auth/storage");
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

router.get("/api/profile/completeness", isAuthenticated, async (req: any, res) => {
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

router.patch("/api/profile", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const profilePatchSchema = z.object({
      phone: z.string().max(30).nullable().optional(),
      mailingAddress: z.string().max(500).nullable().optional(),
    });
    const parsedProfile = profilePatchSchema.safeParse(req.body);
    if (!parsedProfile.success) return res.status(400).json({ message: "Invalid request", errors: parsedProfile.error.flatten() });
    const { phone, mailingAddress } = parsedProfile.data;
    const updates: any = {};
    if (phone !== undefined) updates.phone = phone;
    if (mailingAddress !== undefined) updates.mailingAddress = mailingAddress;
    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    await audit({ req, event: "profile_updated", outcome: "success", userId, metadata: { fields: Object.keys(updates) } });
    res.json(updated);
  } catch (err: any) {
    await audit({ req, event: "profile_updated", outcome: "failure", userId: req.user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
