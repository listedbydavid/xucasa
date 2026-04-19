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

const errorReportLimiter = new Map<string, { count: number; resetAt: number }>();

router.post("/api/error-reports", async (req, res) => {
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

export default router;
