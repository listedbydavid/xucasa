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

router.post("/api/onboarding/intent", onboardingRateLimit, isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const intentSchema = z.object({
    intent: z.enum(["buyer", "homeowner", "agent", "explorer"]),
  });
  const parsed = intentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid intent" });

  try {
    const result = await executeWithAudit(
      { req, event: "onboarding_completed", userId, metadata: { intent: parsed.data.intent } },
      async () => {
        const { authStorage } = await import("../replit_integrations/auth/storage");
        if (parsed.data.intent === "explorer") {
          const updated = await authStorage.updateOnboarding(userId, {
            primaryIntent: parsed.data.intent,
            onboardingCompleted: true,
            currentMode: "explorer",
          });
          return { data: updated };
        }
        const updated = await authStorage.updateOnboarding(userId, {
          primaryIntent: parsed.data.intent,
          currentMode: parsed.data.intent,
        });
        return { data: updated };
      }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to save intent", requestId: req.requestId });
  }
});

router.post("/api/onboarding/buyer", onboardingRateLimit, isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const trimmedTag = z.string().trim().min(1).max(80);
  const buyerSchema = z.object({
    preferredCities: z.array(trimmedTag).max(20).optional().default([]),
    homeTypes: z.array(trimmedTag).max(10).optional().default([]),
    minBeds: z.number().int().min(0).max(20).optional(),
    maxBeds: z.number().int().min(0).max(20).optional(),
    preApprovalAmount: z.number().int().min(0).max(100_000_000).optional(),
    moveInTimeline: z.string().max(80).optional(),
    mustHaves: z.array(trimmedTag).max(30).optional().default([]),
  }).refine(
    d => d.minBeds === undefined || d.maxBeds === undefined || d.minBeds <= d.maxBeds,
    { message: "minBeds must be ≤ maxBeds", path: ["minBeds"] }
  );
  const parsed = buyerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid buyer data", errors: parsed.error.flatten() });

  try {
    const result = await executeWithAudit(
      { req, event: "onboarding_completed", userId, metadata: { intent: "buyer" } },
      async () => {
        const { authStorage } = await import("../replit_integrations/auth/storage");
        const d = parsed.data;

        // Normalize move-in timeline: en-dash → hyphen, lowercase, trim.
        // Empty string after normalization should not overwrite existing values.
        const normalizedTimeline = d.moveInTimeline
          ? d.moveInTimeline.replace(/–/g, "-").trim().toLowerCase()
          : undefined;

        // Build profileData with ONLY the fields the client actually provided
        // so empty defaults from a partial submission don't wipe pre-existing data.
        const profileData: any = {};
        if (d.preferredCities && d.preferredCities.length > 0) profileData.preferredCities = d.preferredCities;
        if (d.homeTypes && d.homeTypes.length > 0) profileData.homeTypes = d.homeTypes;
        if (d.minBeds !== undefined) profileData.minBeds = d.minBeds;
        if (d.maxBeds !== undefined) profileData.maxBeds = d.maxBeds;
        if (d.preApprovalAmount !== undefined) profileData.preApprovalAmount = d.preApprovalAmount;
        if (normalizedTimeline) profileData.moveInTimeline = normalizedTimeline;
        if (d.mustHaves && d.mustHaves.length > 0) profileData.mustHaves = d.mustHaves;

        const existing = await storage.getUserBuyerProfile(userId);
        let profile;
        if (existing) {
          profile = await storage.updateBuyerProfile(existing.id, userId, profileData);
        } else {
          profile = await storage.createBuyerProfile({
            userId,
            displayName: "My Search",
            isPreApproved: false,
            preferredCities: profileData.preferredCities || [],
            homeTypes: profileData.homeTypes || [],
            mustHaves: profileData.mustHaves || [],
            dealBreakers: [],
            minBeds: profileData.minBeds ?? null,
            maxBeds: profileData.maxBeds ?? null,
            preApprovalAmount: profileData.preApprovalAmount ?? 0,
            moveInTimeline: profileData.moveInTimeline ?? null,
          });
        }

        // Score completeness against the just-saved profile so we can decide
        // whether buyerProfileCompleted should flip to true (≥ 60).
        const { score } = buyerProfileCompleteness(profile);

        const updated = await authStorage.updateOnboarding(userId, {
          onboardingCompleted: true,
          currentMode: "buyer",
          ...(score >= 60 ? { buyerProfileCompleted: true } : {}),
        });

        return {
          data: {
            destination: resolveUserDestination(updated),
            completenessScore: score,
            profile,
          },
        };
      }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to save buyer profile", requestId: req.requestId });
  }
});

router.post("/api/onboarding/homeowner", onboardingRateLimit, isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const homeSchema = z.object({
    address: z.string().min(1),
    beds: z.number().optional(),
    baths: z.number().optional(),
    sqft: z.number().optional(),
    yearBuilt: z.number().optional(),
    sellingIntent: z.string().optional(),
  });
  const parsed = homeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid homeowner data" });

  try {
    const result = await executeWithAudit(
      { req, event: "onboarding_completed", userId, metadata: { intent: "homeowner" } },
      async () => {
        const { authStorage } = await import("../replit_integrations/auth/storage");
        const addressParts = parsed.data.address.split(",").map(s => s.trim());
        const streetPart = addressParts[0] || "";
        const streetMatch = streetPart.match(/^(\d+)\s+(.+)$/);

        const homeData = {
          nickname: "My Home",
          addressStreetNumber: streetMatch ? streetMatch[1] : null,
          addressStreetName: streetMatch ? streetMatch[2] : streetPart,
          addressCity: addressParts[1] || null,
          addressState: addressParts[2]?.replace(/\s*\d{5}.*/, '').trim() || "CA",
          addressZip: addressParts[2]?.match(/\d{5}/)?.[0] || null,
          beds: parsed.data.beds || null,
          baths: parsed.data.baths ? String(parsed.data.baths) : null,
          sqft: parsed.data.sqft || null,
          yearBuilt: parsed.data.yearBuilt || null,
          notes: parsed.data.sellingIntent || null,
        };

        const existingHomes = await storage.getUserHomes(userId);
        if (existingHomes.length > 0) {
          await storage.updateUserHome(existingHomes[0].id, userId, homeData);
        } else {
          await storage.createUserHome(userId, homeData);
        }

        const updated = await authStorage.updateOnboarding(userId, {
          homeownerProfileCompleted: true,
          onboardingCompleted: true,
          currentMode: "homeowner",
        });
        return { data: updated };
      }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to save homeowner data", requestId: req.requestId });
  }
});

router.post("/api/onboarding/agent", onboardingRateLimit, isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const agentSchema = z.object({
    licenseNumber: z.string().min(2).max(30),
    licenseState: z.string().default("CA"),
    brokerageName: z.string().optional(),
    mlsId: z.string().optional(),
    association: z.string().optional(),
  });
  const parsed = agentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid agent data" });
  if (!/^[A-Za-z0-9\-. ]{2,30}$/.test(parsed.data.licenseNumber.trim())) {
    return res.status(400).json({ message: "License number contains invalid characters" });
  }

  try {
    const { authStorage } = await import("../replit_integrations/auth/storage");
    const license = parsed.data.licenseNumber.trim();

    await authStorage.updateAgentInfo(userId, {
      licenseNumber: license,
      licenseState: parsed.data.licenseState,
      brokerageName: parsed.data.brokerageName || null,
      agentMlsId: parsed.data.mlsId || null,
      association: parsed.data.association || null,
    });
    await authStorage.updateOnboarding(userId, {
      agentProfileCompleted: true,
      onboardingCompleted: true,
      currentMode: "agent",
    });

    const verifyResult = await runAgentVerificationFlow(req, userId, {
      licenseNumber: license,
      licenseState: parsed.data.licenseState || null,
      association: parsed.data.association || null,
      brokerageName: parsed.data.brokerageName || null,
    });

    await audit({
      req,
      event: "onboarding_completed",
      outcome: "success",
      userId,
      metadata: { intent: "agent", verified: verifyResult.verified },
    });

    return res.json(verifyResult);
  } catch (err: any) {
    console.error("Onboarding agent error:", err);
    await audit({
      req,
      event: "agent_verify_failed",
      outcome: "failure",
      userId,
      errorMessage: err?.message,
      metadata: {
        licenseNumber: parsed.data.licenseNumber.trim(),
        licenseState: parsed.data.licenseState,
        source: "onboarding",
      },
    });
    res.status(500).json({ message: "Failed to save agent data", requestId: req.requestId });
  }
});

router.post("/api/onboarding/lender", onboardingRateLimit, isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const lenderSchema = z.object({
    companyName: z.string().min(1),
    nmls: z.string().optional(),
    licenseState: z.string().optional(),
    specialties: z.array(z.string()).optional().default([]),
    bio: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
  });
  const parsed = lenderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  }

  try {
    await executeWithAudit(
      { req, event: "onboarding_completed", userId, metadata: { intent: "lender" } },
      async () => {
        await storage.upsertLenderProfile(userId, parsed.data);
        await authStorage.updateOnboarding(userId, {
          onboardingCompleted: true,
          primaryIntent: "lender",
          currentMode: "lender",
        });
      },
    );
    return res.json({ destination: "/dashboard" });
  } catch (err: any) {
    console.error("Onboarding lender error:", err);
    return res.status(500).json({ message: "Failed to save lender data", requestId: req.requestId });
  }
});

router.post("/api/onboarding/switch-mode", onboardingRateLimit, isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const modeSchema = z.object({
    mode: z.enum(["buyer", "homeowner", "agent", "explorer"]),
  });
  const parsed = modeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid mode" });

  try {
    const result = await executeWithAudit(
      { req, event: "mode_switched", userId, metadata: { newMode: parsed.data.mode } },
      async () => {
        const { authStorage } = await import("../replit_integrations/auth/storage");
        const user = await authStorage.getUser(userId);
        if (!user) throw new Error("User not found");

        const modeMap: Record<string, string | undefined> = {
          buyer: user.buyerProfileCompleted ? "buyer" : undefined,
          homeowner: user.homeownerProfileCompleted ? "homeowner" : undefined,
          agent: user.agentProfileCompleted ? "agent" : undefined,
          explorer: "explorer",
        };

        if (!modeMap[parsed.data.mode]) {
          throw new Error("Complete this profile first before switching to it");
        }

        const updated = await authStorage.updateOnboarding(userId, {
          currentMode: parsed.data.mode,
        });
        return { data: updated };
      }
    );
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "User not found") return res.status(404).json({ message: msg });
    if (msg.includes("Complete this profile")) return res.status(400).json({ message: msg });
    res.status(500).json({ message: "Failed to switch mode", requestId: req.requestId });
  }
});

export default router;
