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

import { checkFairHousing } from "../lib/notificationHelpers";

function redactBuyerProfile(profile: any) {
  const {
    clientName, clientEmail, clientPhone,
    preApprovalLetter, lenderName, lenderPhone, lenderEmail,
    buyerAgentName, buyerAgentPhone, buyerAgentEmail,
    needsLenderReferral, needsAgentReferral,
    ...safe
  } = profile;
  return safe;
}

router.post("/api/swipe-interest", isAuthenticated, async (req: any, res) => {
  const buyerUserId = req.user.claims.sub;
  const parsedSwipe = z.object({ propertyId: z.number().int().positive() }).safeParse(req.body);
  if (!parsedSwipe.success) return res.status(400).json({ message: "propertyId required", errors: parsedSwipe.error.flatten() });
  const { propertyId } = parsedSwipe.data;

  try {
    const result = await executeWithAudit<any>(
      { req, event: "swipe_interest_created", userId: buyerUserId, propertyId },
      async () => {
        const prop = await storage.getProperty(propertyId);
        if (!prop) throw new Error("Property not found");

        const { agent: assignedAgent, assignmentType } = await resolveBuyerAgent(buyerUserId, storage);
        await storage.upsertBuyerInterest(propertyId, buyerUserId, "swipe", assignedAgent?.id ?? undefined, prop?.agentId ?? undefined);

        const existing = await storage.getExistingSwipeNotification(buyerUserId, propertyId);
        if (existing) return { data: { message: "Already notified", notification: existing, _status: 200 } };

        if (!assignedAgent) throw new Error("No agent assigned. Please contact support.");

        const sellerRepresented = !!(prop.agentId || prop.listingAgentEmail);
        const listingAgentEmail = prop.listingAgentEmail || null;

        const n = await storage.createSwipeNotification({
          buyerUserId,
          propertyId,
          notifiedParty: "assigned_agent",
          notifiedUserId: assignedAgent.id,
          notifiedEmail: assignedAgent.email || "",
          buyerRepresented: true,
          sellerRepresented,
          buyerAgentEmail: assignedAgent.email || null,
          listingAgentEmail,
          status: "notified",
        });

        return {
          data: { message: "Interest registered", notifications: [n], buyerRepresented: true, sellerRepresented, _status: 201 },
          auditOverrides: { metadata: { notificationId: n.id, assignmentType, agentId: assignedAgent.id } },
        };
      }
    );
    const status = (result as any)._status || 200;
    res.status(status).json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Property not found") return res.status(404).json({ message: msg });
    if (msg.includes("No agent assigned")) return res.status(400).json({ message: msg });
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/api/buyer-profiles", async (req, res) => {
  try {
    const profiles = await storage.getBuyerProfiles(req.query);
    res.json(profiles.map(redactBuyerProfile));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/buyer-profile/completeness", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const profile = await storage.getUserBuyerProfile(userId);
    if (!profile) {
      return res.json({ score: 0, missingFields: [], profile: null, noProfile: true });
    }
    const { score, missingFields } = buyerProfileCompleteness(profile);
    res.json({ score, missingFields, profile });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/api/buyer-profile", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const updateSchema = z.object({
      minBeds: z.number().int().min(0).max(20).nullable().optional(),
      maxBeds: z.number().int().min(0).max(20).nullable().optional(),
      minBaths: z.coerce.number().min(0).max(20).nullable().optional(),
      minSqft: z.number().int().min(0).max(100000).nullable().optional(),
      maxSqft: z.number().int().min(0).max(100000).nullable().optional(),
      preferredCities: z.array(z.string().min(1)).max(50).nullable().optional(),
      homeTypes: z.array(z.string().min(1)).max(20).nullable().optional(),
      mustHaves: z.array(z.string().min(1)).max(50).nullable().optional(),
      niceToHaves: z.array(z.string().min(1)).max(50).nullable().optional(),
      dealBreakers: z.array(z.string().min(1)).max(50).nullable().optional(),
      moveInTimeline: z.string().max(50).nullable().optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid profile update", errors: parsed.error.flatten() });
    }

    const profile = await storage.getUserBuyerProfile(userId);
    if (!profile) {
      return res.status(404).json({ message: "No buyer profile found. Create one first." });
    }

    // Normalize moveInTimeline: en-dash → hyphen, lowercase
    const updates: any = { ...parsed.data };
    if (typeof updates.moveInTimeline === 'string') {
      updates.moveInTimeline = updates.moveInTimeline.replace(/–/g, '-').toLowerCase().trim();
    }
    // Coerce minBaths to string for decimal column
    if (updates.minBaths != null && typeof updates.minBaths === 'number') {
      updates.minBaths = String(updates.minBaths);
    }

    const result = await executeWithAudit(
      { req, event: "buyer_profile_updated", userId, metadata: { fields: Object.keys(updates) } },
      async () => {
        const updated = await storage.updateBuyerProfile(profile.id, userId, updates);
        return { data: updated, auditOverrides: { resourceType: "buyer_profile", resourceId: String(profile.id) } };
      }
    );
    const completeness = buyerProfileCompleteness(result as any);
    res.json({ profile: result, ...completeness });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/buyer-profiles/mine", isAuthenticated, async (req, res) => {
  try {
    const profile = await storage.getUserBuyerProfile(req.user!.claims.sub);
    res.json(profile || null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/buyer-profiles/:id", async (req, res) => {
  try {
    const profile = await storage.getBuyerProfile(parseInt(req.params.id));
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json(redactBuyerProfile(profile));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/buyer-profiles", isAuthenticated, async (req, res) => {
  try {
    const { insertBuyerProfileSchema } = await import("@workspace/db");
    const parsed = (insertBuyerProfileSchema as z.ZodObject<any>).omit({ userId: true, agentId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    const textToCheck = [
      ...(parsed.data.mustHaves || []),
      ...(parsed.data.niceToHaves || []),
      ...(parsed.data.dealBreakers || []),
      parsed.data.bio || "",
    ].join(" ");
    const violation = checkFairHousing(textToCheck);
    if (violation) return res.status(400).json({ message: violation });

    let agentId: string | null = null;
    let agentLinked = false;
    if (parsed.data.hasAgent && parsed.data.buyerAgentEmail) {
      const agentUser = await db.select().from(users)
        .where(eq(users.email, parsed.data.buyerAgentEmail.trim().toLowerCase()))
        .limit(1);
      if (agentUser.length > 0) {
        agentId = agentUser[0].id;
        agentLinked = true;
      }
    }

    const data = {
      ...parsed.data,
      userId: req.user!.claims.sub,
      agentId,
      needsLenderReferral: parsed.data.isPreApproved === false,
      needsAgentReferral: parsed.data.hasAgent === false,
    };
    const profile = await storage.createBuyerProfile(data);
    res.status(201).json({ ...profile, agentLinked });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/api/buyer-profiles/:id", isAuthenticated, async (req, res) => {
  try {
    const { insertBuyerProfileSchema } = await import("@workspace/db");
    const parsed = (insertBuyerProfileSchema as z.ZodObject<any>).omit({ userId: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    const textToCheck = [
      ...(parsed.data.mustHaves || []),
      ...(parsed.data.niceToHaves || []),
      ...(parsed.data.dealBreakers || []),
      parsed.data.bio || "",
    ].join(" ");
    const violation = checkFairHousing(textToCheck);
    if (violation) return res.status(400).json({ message: violation });

    const updateData: any = { ...parsed.data };

    if (parsed.data.hasAgent !== undefined) {
      updateData.needsAgentReferral = parsed.data.hasAgent === false;
    }
    if (parsed.data.isPreApproved !== undefined) {
      updateData.needsLenderReferral = parsed.data.isPreApproved === false;
    }

    if (parsed.data.hasAgent && parsed.data.buyerAgentEmail) {
      const agentUser = await db.select().from(users)
        .where(eq(users.email, parsed.data.buyerAgentEmail.trim().toLowerCase()))
        .limit(1);
      if (agentUser.length > 0) {
        updateData.agentId = agentUser[0].id;
      }
    } else if (parsed.data.hasAgent === false) {
      updateData.agentId = null;
      updateData.buyerAgentName = null;
      updateData.buyerAgentPhone = null;
      updateData.buyerAgentEmail = null;
    }

    const updated = await storage.updateBuyerProfile(
      parseInt(String(req.params.id)),
      req.user!.claims.sub,
      updateData
    );
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/buyer-profiles/:id", isAuthenticated, async (req, res) => {
  try {
    await storage.deleteBuyerProfile(parseInt(String(req.params.id)), req.user!.claims.sub);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/buyer-interest", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const parsedInterest = z.object({
    propertyId: z.number().int().positive(),
    source: z.string().max(50).optional(),
  }).safeParse(req.body);
  if (!parsedInterest.success) return res.status(400).json({ message: "propertyId required", errors: parsedInterest.error.flatten() });
  const { propertyId, source } = parsedInterest.data;

  try {
    const result = await executeWithAudit(
      { req, event: "buyer_interest_upserted", userId, propertyId, metadata: { source: source || "swipe" } },
      async () => {
        const prop = await storage.getProperty(propertyId);
        const { agent: assignedAgent, assignmentType } = await resolveBuyerAgent(userId, storage);
        const bi = await storage.upsertBuyerInterest(
          propertyId, userId, source || "swipe",
          assignedAgent?.id ?? undefined,
          prop?.agentId ?? undefined
        );

        if (assignedAgent && (source === "swipe" || !source)) {
          const buyer = await storage.getUser(userId);
          const buyerName = buyer?.firstName ? `${buyer.firstName} ${buyer.lastName || ""}`.trim() : "A buyer";
          const propTitle = prop?.title || `Property #${propertyId}`;
          await storage.createNotification({
            userId: assignedAgent.id,
            type: "buyer_interest",
            title: `${buyerName} is interested in a property`,
            message: `${buyerName} expressed interest in ${propTitle}`,
            propertyId,
            linkUrl: `/agent/dashboard`,
            read: false,
            archived: false,
          });
        }

        return { data: bi, auditOverrides: { buyerInterestId: bi.id } };
      }
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/api/assigned-agent", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const agent = await storage.lookupAssignedAgent(userId);
    if (!agent) return res.status(404).json({ message: "No assigned agent found" });
    res.json({
      id: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      email: agent.email,
      phone: agent.phone,
      profileImageUrl: agent.profileImageUrl,
      brokerageName: agent.brokerageName,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/buyer-interest", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const role = req.query.role;
    if (role === "agent") {
      const interests = await storage.getBuyerInterestForAgent(userId);
      res.json(interests);
    } else {
      const interests = await storage.getBuyerInterestForBuyer(userId);
      res.json(interests);
    }
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/buyer-interest/agent", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const interests = await storage.getBuyerInterestForAgent(userId);
    res.json(interests);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/buyer-interest/mine", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const interests = await storage.getBuyerInterestForBuyer(userId);
    res.json(interests);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/api/buyer-interest/:id", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const id = parseInt(req.params.id);
  const parsedStage = z.object({ stage: z.string().max(50).optional() }).safeParse(req.body);
  if (!parsedStage.success) return res.status(400).json({ message: "Invalid request", errors: parsedStage.error.flatten() });
  const { stage } = parsedStage.data;

  const existing = await db.select().from(buyerInterest).where(eq(buyerInterest.id, id)).limit(1);
  if (!existing.length) return res.status(404).json({ message: "Not found" });

  const isAssignedAgent = existing[0].assignedAgentUserId === userId;
  if (!isAssignedAgent && existing[0].buyerUserId !== userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  const validStages = ["interested", "agent_reviewing", "coordinating", "showing_scheduled", "offer_stage", "closed", "archived"];
  if (stage && !validStages.includes(stage)) {
    return res.status(400).json({ message: `Invalid stage. Must be one of: ${validStages.join(", ")}` });
  }

  try {
    const result = await executeWithAudit(
      { req, event: "buyer_interest_upserted", userId, buyerInterestId: id, metadata: { stage } },
      async () => {
        const updates: any = { updatedAt: new Date() };
        if (stage) updates.stage = stage;
        const [updated] = await db.update(buyerInterest).set(updates).where(eq(buyerInterest.id, id)).returning();
        return { data: updated };
      }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

export default router;
