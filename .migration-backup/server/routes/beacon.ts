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

router.get("/api/beacon/match-buyers", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user?.claims;
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const { authStorage } = await import("../replit_integrations/auth/storage");
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
      mustHaves: z.string().optional().default(""),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid parameters", errors: parsed.error.flatten() });

    const mustHaves = parsed.data.mustHaves
      ? parsed.data.mustHaves.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const matches = await storage.matchBuyersForListing({ ...parsed.data, mustHaves });

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
      matchScore: profile.matchScore,
      matchTier: profile.matchTier,
      scoreBreakdown: profile.scoreBreakdown,
    }));

    res.json({ matches: safeMatches, total: safeMatches.length });
  } catch (err) {
    console.error("Beacon match error:", err);
    res.status(500).json({ message: "Failed to match buyers" });
  }
});

export default router;
