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

import { trySendNotificationEmail, checkFairHousing } from "../lib/notificationHelpers";

router.post("/api/seller-pitches", async (req: any, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const userId = req.user?.claims?.sub || null;
    const pitch = await storage.createSellerPitch({ ...body, userId });
    await audit({ req, event: "seller_pitch_created", outcome: "success", userId, metadata: { email: body.email } });
    res.status(201).json(pitch);
  } catch (err: any) {
    await audit({ req, event: "seller_pitch_created", outcome: "failure", errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/buyer-matches", isAuthenticated, async (req, res) => {
  try {
    const { insertBuyerMatchSchema } = await import("@shared/schema");
    const parsed = insertBuyerMatchSchema.omit({ senderId: true, conversationId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    if (parsed.data.message) {
      const violation = checkFairHousing(parsed.data.message);
      if (violation) return res.status(400).json({ message: violation });
    }
    const userId = req.user!.claims.sub;

    if (parsed.data.propertyId) {
      const property = await storage.getProperty(parsed.data.propertyId);
      if (!property) return res.status(404).json({ message: "Property not found" });
      if (property.agentId !== userId) {
        const user = await storage.getUser(userId);
        const isAdmin = !!(process.env.ADMIN_EMAIL && user?.email && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase());
        if (!isAdmin) {
          return res.status(403).json({ message: "You can only pitch properties you own" });
        }
      }
    }

    const data = { ...parsed.data, senderId: userId };
    const match = await storage.createBuyerMatch(data);
    await audit({ req, event: "buyer_match_created", outcome: "success", userId, propertyId: parsed.data.propertyId, metadata: { matchId: match.id, buyerProfileId: parsed.data.buyerProfileId } });

    const profile = await storage.getBuyerProfile(parsed.data.buyerProfileId);
    if (profile && parsed.data.propertyId && parsed.data.message) {
      const buyerUserId = profile.userId;
      const senderUser = await storage.getUser(userId);
      const senderName = senderUser?.firstName ? `${senderUser.firstName} ${senderUser.lastName || ""}`.trim() : "A seller";

      const assignedAgent = await storage.resolveAndAssignAgent(buyerUserId);
      if (assignedAgent) {
        const prop = await storage.getProperty(parsed.data.propertyId);
        await storage.upsertBuyerInterest(parsed.data.propertyId, buyerUserId, "reverse_offer", assignedAgent.id, prop?.agentId ?? undefined);

        if (assignedAgent.id === userId) {
          const buyerConvo = await storage.getOrCreateConversation(parsed.data.propertyId, buyerUserId, assignedAgent.id, "agent", "buyer");
          await storage.createMessage({
            conversationId: buyerConvo.id,
            senderUserId: userId,
            type: "text",
            content: `Property pitch: ${parsed.data.message}`,
            metadata: { pitchId: match.id },
          });
          await storage.updateBuyerMatchConversationId(match.id, buyerConvo.id);
          await storage.createNotification({
            userId: buyerUserId,
            type: "message_received",
            title: `Property pitch from ${senderName}`,
            message: (parsed.data.message || "").substring(0, 200),
            propertyId: parsed.data.propertyId,
            linkUrl: `/conversations/${buyerConvo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(buyerUserId, "message_received", `Property pitch from ${senderName}`, (parsed.data.message || "").substring(0, 200), `/conversations/${buyerConvo.id}`, parsed.data.propertyId, buyerConvo.id);
        } else {
          const coordConvo = await storage.getOrCreateConversation(parsed.data.propertyId, assignedAgent.id, userId, "agent", "agent_coordination", buyerUserId);
          await storage.createMessage({
            conversationId: coordConvo.id,
            senderUserId: userId,
            type: "text",
            content: `Property pitch for ${profile.displayName || "a buyer"}: ${parsed.data.message}`,
            metadata: { pitchId: match.id },
          });
          await storage.updateBuyerMatchConversationId(match.id, coordConvo.id);
          await storage.createNotification({
            userId: assignedAgent.id,
            type: "message_received",
            title: `Property pitch from ${senderName}`,
            message: `${senderName} pitched a property to your client. ${(parsed.data.message || "").substring(0, 100)}`,
            propertyId: parsed.data.propertyId,
            linkUrl: `/conversations/${coordConvo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(assignedAgent.id, "message_received", `Property pitch from ${senderName}`, `${senderName} pitched a property to your client.`, `/conversations/${coordConvo.id}`, parsed.data.propertyId, coordConvo.id);
        }
      }
    }

    res.status(201).json(match);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/buyer-matches/profile/:profileId", isAuthenticated, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params.profileId));
    const profile = await storage.getBuyerProfile(profileId);
    if (!profile || profile.userId !== req.user!.claims.sub) {
      return res.status(403).json({ message: "Access denied" });
    }
    const matches = await storage.getBuyerMatchesForProfile(profileId);
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/buyer-matches/sent", isAuthenticated, async (req, res) => {
  try {
    const matches = await storage.getBuyerMatchesForSender(req.user!.claims.sub);
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
