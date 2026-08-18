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

const testEmailLimiter = new Map<string, number>();

router.get("/api/idx/status", isAuthenticated, async (_req, res) => {
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

router.post("/api/idx/sync", isAuthenticated, async (req: any, res) => {
  if (!idxConfigured()) {
    return res.status(400).json({
      message: "IDX not configured. Add IDX_BROKER_API_KEY (from your IDX Broker account dashboard) as an environment variable.",
    });
  }
  if (isSyncInProgress()) {
    return res.status(409).json({ message: "Sync already running. Check back in a moment." });
  }
  // Run async — respond immediately
  await audit({ req, event: "idx_sync_triggered", outcome: "success", userId: (req as any).user?.claims?.sub });
  res.json({ message: "Sync started" });
  runIdxSync().catch(e => console.error("[IDX] Manual sync error:", e.message));
});

router.get("/api/email-status", isAuthenticated, async (req: any, res) => {
  try {
    const configured = await isEmailConfigured();
    res.json({ configured });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/test-email", isAuthenticated, async (req: any, res) => {
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

export default router;
