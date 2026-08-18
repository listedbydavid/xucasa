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

import { trySendNotificationEmail } from "../lib/notificationHelpers";

router.post("/api/property-offers", isAuthenticated, async (req: any, res) => {
  const creatorId = req.user.claims.sub;
  const offerSchema = z.object({
    propertyId: z.number().int().positive(),
    buyerUserId: z.string().min(1),
    offerPrice: z.number().optional(),
    escrowLengthDays: z.number().int().optional(),
    inspectionContingencyDays: z.number().int().optional(),
    loanContingencyDays: z.number().int().optional(),
    appraisalContingencyDays: z.number().int().optional(),
    insuranceContingencyDays: z.number().int().optional(),
    disclosureReviewDays: z.number().int().optional(),
    leasedLienedItemsDays: z.number().int().optional(),
    sellerConcessions: z.number().optional(),
    sellerConcessionNotes: z.string().max(2000).optional().nullable(),
    buydownOffered: z.boolean().optional(),
    buydownType: z.string().max(100).optional().nullable(),
    buydownAmount: z.number().optional().nullable(),
    additionalTerms: z.string().max(5000).optional().nullable(),
    swipeNotificationId: z.number().int().positive().optional(),
  });
  const parsedOffer = offerSchema.safeParse(req.body);
  if (!parsedOffer.success) return res.status(400).json({ message: "propertyId and buyerUserId required", errors: parsedOffer.error.flatten() });
  const {
    propertyId, buyerUserId, offerPrice, escrowLengthDays,
    inspectionContingencyDays, loanContingencyDays, appraisalContingencyDays,
    insuranceContingencyDays, disclosureReviewDays, leasedLienedItemsDays,
    sellerConcessions, sellerConcessionNotes,
    buydownOffered, buydownType, buydownAmount,
    additionalTerms, swipeNotificationId,
  } = parsedOffer.data;

  try {
    const result = await executeWithAudit(
      { req, event: "reverse_offer_created", userId: creatorId, propertyId, metadata: { buyerUserId, offerPrice } },
      async () => {
    const prop = await storage.getProperty(propertyId);
    if (!prop) throw new Error("Property not found");

    const creator = await storage.getUser(creatorId);
    const isAdmin = creator?.email === process.env.ADMIN_EMAIL;
    const isListingAgent = prop.agentId === creatorId;
    if (!isListingAgent && !isAdmin) {
      throw new Error("Only the listing agent or admin can create reverse offers");
    }

    const buyerProfile = await storage.getUserBuyerProfile(buyerUserId);
    const buyerLink = await storage.getClientAgentLink(buyerUserId);
    const buyerAgentId = buyerProfile?.agentId || buyerLink?.agentId || null;

    const offer = await storage.createPropertyOffer({
      propertyId,
      buyerUserId,
      buyerProfileId: buyerProfile?.id || null,
      sellerUserId: prop.agentId || null,
      listingAgentId: prop.agentId || null,
      buyerAgentId,
      offerPrice: offerPrice || prop.price,
      escrowLengthDays: escrowLengthDays || 30,
      inspectionContingencyDays: inspectionContingencyDays ?? 17,
      loanContingencyDays: loanContingencyDays ?? 21,
      appraisalContingencyDays: appraisalContingencyDays ?? 17,
      insuranceContingencyDays: insuranceContingencyDays ?? 5,
      disclosureReviewDays: disclosureReviewDays ?? 7,
      leasedLienedItemsDays: leasedLienedItemsDays ?? 5,
      sellerConcessions: sellerConcessions || 0,
      sellerConcessionNotes: sellerConcessionNotes || null,
      buydownOffered: buydownOffered || false,
      buydownType: buydownType || null,
      buydownAmount: buydownAmount || null,
      additionalTerms: additionalTerms || null,
      status: "sent_to_buyer",
      triggeredBySwipe: !!swipeNotificationId,
    });

    if (swipeNotificationId) {
      await storage.updateSwipeNotificationStatus(swipeNotificationId, "offer_created", offer.id);
    }

    const assignedAgent = await storage.resolveAndAssignAgent(buyerUserId);
    if (assignedAgent) {
      await storage.upsertBuyerInterest(propertyId, buyerUserId, "reverse_offer", assignedAgent.id, prop.agentId ?? undefined);
      const creatorName = creator?.firstName ? `${creator.firstName} ${creator.lastName || ""}`.trim() : "Listing Agent";

      if (assignedAgent.id === creatorId) {
        const buyerConvo = await storage.getOrCreateConversation(propertyId, buyerUserId, assignedAgent.id, "agent", "buyer");
        await storage.createMessage({
          conversationId: buyerConvo.id,
          senderUserId: creatorId,
          type: "reverse_offer",
          content: `Reverse offer: $${(offerPrice || prop.price).toLocaleString()}`,
          metadata: { offerId: offer.id },
        });
        await storage.createNotification({
          userId: buyerUserId,
          type: "message_received",
          title: `Reverse offer from ${creatorName}`,
          message: `You received a reverse offer for $${(offerPrice || prop.price).toLocaleString()}`,
          propertyId,
          linkUrl: `/conversations/${buyerConvo.id}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(buyerUserId, "message_received", `Reverse offer from ${creatorName}`, `You received a reverse offer for $${(offerPrice || prop.price).toLocaleString()}`, `/conversations/${buyerConvo.id}`, propertyId, buyerConvo.id);
      } else {
        const coordConvo = await storage.getOrCreateConversation(propertyId, assignedAgent.id, creatorId, "agent", "agent_coordination", buyerUserId);
        await storage.createMessage({
          conversationId: coordConvo.id,
          senderUserId: creatorId,
          type: "reverse_offer",
          content: `Reverse offer for buyer: $${(offerPrice || prop.price).toLocaleString()}`,
          metadata: { offerId: offer.id },
        });
        await storage.createNotification({
          userId: assignedAgent.id,
          type: "message_received",
          title: `Reverse offer from ${creatorName}`,
          message: `${creatorName} sent a reverse offer of $${(offerPrice || prop.price).toLocaleString()} for your client`,
          propertyId,
          linkUrl: `/conversations/${coordConvo.id}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(assignedAgent.id, "message_received", `Reverse offer from ${creatorName}`, `Reverse offer for your client`, `/conversations/${coordConvo.id}`, propertyId, coordConvo.id);

        const agentName = assignedAgent.firstName ? `${assignedAgent.firstName} ${assignedAgent.lastName || ""}`.trim() : "Your agent";
        const priceStr = `$${(offerPrice || prop.price).toLocaleString()}`;
        const terms: string[] = [];
        if (escrowLengthDays) terms.push(`${escrowLengthDays}-day escrow`);
        if (sellerConcessions) terms.push(`$${sellerConcessions.toLocaleString()} seller concessions`);
        if (buydownOffered) terms.push(`buydown: ${buydownType || "offered"}`);
        const termsStr = terms.length > 0 ? `\nKey terms: ${terms.join(", ")}` : "";

        const buyerConvo = await storage.getOrCreateConversation(propertyId, buyerUserId, assignedAgent.id, "agent", "buyer");
        await storage.createMessage({
          conversationId: buyerConvo.id,
          senderUserId: assignedAgent.id,
          type: "reverse_offer",
          content: `${agentName} has presented you with an offer: ${priceStr}${termsStr}`,
          metadata: { offerId: offer.id },
        });
        await storage.createNotification({
          userId: buyerUserId,
          type: "message_received",
          title: `${agentName} presented an offer`,
          message: `You received an offer for ${priceStr}`,
          propertyId,
          linkUrl: `/conversations/${buyerConvo.id}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(buyerUserId, "message_received", `${agentName} presented an offer`, `You received an offer for ${priceStr}`, `/conversations/${buyerConvo.id}`, propertyId, buyerConvo.id);
      }
    }

    return {
          data: offer,
          auditOverrides: { resourceType: "property_offer", resourceId: String(offer.id), metadata: { buyerUserId, offerPrice: offerPrice || prop.price } },
        };
      }
    );
    res.status(201).json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Property not found") return res.status(404).json({ message: msg });
    if (msg.includes("Only the listing agent")) return res.status(403).json({ message: msg });
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/api/property-offers/statuses", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const idsParam = req.query.ids as string;
    if (!idsParam) return res.json({});
    const ids = idsParam.split(",").map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.json({});
    const rows = await db.select().from(propertyOffers).where(inArray(propertyOffers.id, ids));
    const results: Record<number, string> = {};
    for (const offer of rows) {
      if (offer.buyerUserId === userId || offer.listingAgentId === userId || offer.buyerAgentId === userId) {
        results[offer.id] = offer.status;
      }
    }
    const callerUser = await storage.getUser(userId);
    if (callerUser?.role === "admin") {
      for (const offer of rows) {
        results[offer.id] = offer.status;
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/property-offers/incoming", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.role === "agent" || user?.role === "admin") {
      const offers = await storage.getPropertyOffersForAgent(userId);
      res.json(offers);
    } else {
      res.status(403).json({ message: "Offer details are communicated through your assigned agent" });
    }
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/property-offers/agent", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user.claims.sub;
    const offers = await storage.getPropertyOffersForAgent(agentId);
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/swipe-notifications/agent", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const notifications = await storage.getSwipeNotificationsForUser(userId);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/api/property-offers/:id/status", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const validStatuses = ["pending_agent_review", "sent_to_buyer", "viewed", "accepted", "rejected", "countered", "declined", "expired", "pending_admin"] as const;
    const parsedStatus = z.object({
      status: z.enum(validStatuses),
      adminNotes: z.string().max(2000).optional().nullable(),
    }).safeParse(req.body);
    if (!parsedStatus.success) return res.status(400).json({ message: "Invalid status", errors: parsedStatus.error.flatten() });
    const { status, adminNotes } = parsedStatus.data;

    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdminUser = user?.email === process.env.ADMIN_EMAIL;

    const offers = await db.select().from(propertyOffers).where(eq(propertyOffers.id, id));
    const offer = offers[0];
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    const assignedAgent = offer.buyerUserId ? await storage.lookupAssignedAgent(offer.buyerUserId) : null;
    const isAssignedAgent = assignedAgent?.id === userId;

    const assignedAgentStatuses = ["accepted", "rejected", "declined", "countered", "viewed", "pending_agent_review"];
    const listingAgentStatuses = ["sent_to_buyer", "expired"];

    if (assignedAgentStatuses.includes(status) && !isAssignedAgent && !isAdminUser) {
      return res.status(403).json({ message: "Only the assigned agent can respond to this offer on behalf of the buyer" });
    }
    if (listingAgentStatuses.includes(status) && offer.listingAgentId !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Only the listing agent or admin can update this status" });
    }

    const updated = await storage.updatePropertyOfferStatus(id, status, adminNotes ?? undefined);
    await audit({ req, event: "offer_status_changed", outcome: "success", userId, propertyId: offer.propertyId, metadata: { offerId: id, status, previousStatus: offer.status } });

    const offerResponseStatuses = ["accepted", "rejected", "declined", "countered"];
    if ((offerResponseStatuses.includes(status) || listingAgentStatuses.includes(status)) && offer.propertyId) {
      const statusLabel = status === "countered" ? "counter-offered" : status === "sent_to_buyer" ? "sent to buyer's agent" : status;
      const buyerUser = await storage.getUser(offer.buyerUserId!);
      const buyerName = buyerUser?.firstName ? `${buyerUser.firstName} ${buyerUser.lastName || ""}`.trim() : "Buyer";

      const resolvedAssignedAgent = offer.buyerUserId ? await storage.lookupAssignedAgent(offer.buyerUserId) : null;
      const agentId = resolvedAssignedAgent?.id;
      const listingAgentId = offer.listingAgentId;

      const now = new Date();
      await db.update(buyerInterest)
        .set({ stage: "offer_stage", lastActivityAt: now, updatedAt: now })
        .where(and(eq(buyerInterest.propertyId, offer.propertyId), eq(buyerInterest.buyerUserId, offer.buyerUserId!)));

      if (offerResponseStatuses.includes(status) && agentId) {
        const buyerConvo = await storage.getOrCreateConversation(offer.propertyId, offer.buyerUserId!, agentId, "agent", "buyer");
        await storage.createMessage({
          conversationId: buyerConvo.id,
          senderUserId: agentId,
          type: "system",
          content: `Offer has been ${statusLabel}.`,
        });
        await storage.createNotification({
          userId: offer.buyerUserId!,
          type: "offer_response",
          title: `Offer ${statusLabel}`,
          message: `Your offer has been ${statusLabel}.`,
          propertyId: offer.propertyId,
          linkUrl: `/conversations/${buyerConvo.id}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(offer.buyerUserId!, "offer_response", `Offer ${statusLabel}`, `Your offer has been ${statusLabel}.`, `/conversations/${buyerConvo.id}`, offer.propertyId, buyerConvo.id);

        if (listingAgentId && agentId !== listingAgentId) {
          const coordConvo = await storage.getOrCreateConversation(offer.propertyId, agentId, listingAgentId, "agent", "agent_coordination", offer.buyerUserId!);
          await storage.createMessage({
            conversationId: coordConvo.id,
            senderUserId: agentId,
            type: "system",
            content: `${buyerName}'s agent has ${statusLabel} the offer.`,
          });
          await storage.createNotification({
            userId: listingAgentId,
            type: "offer_response",
            title: `Offer ${statusLabel}`,
            message: `${buyerName}'s agent has ${statusLabel} the offer.`,
            propertyId: offer.propertyId,
            linkUrl: `/conversations/${coordConvo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(listingAgentId, "offer_response", `Offer ${statusLabel}`, `${buyerName}'s agent has ${statusLabel} the offer.`, `/conversations/${coordConvo.id}`, offer.propertyId, coordConvo.id);
        }
      }

      if (listingAgentStatuses.includes(status) && listingAgentId && agentId) {
        if (agentId !== listingAgentId) {
          const coordConvo = await storage.getOrCreateConversation(offer.propertyId, agentId, listingAgentId, "agent", "agent_coordination", offer.buyerUserId!);
          await storage.createMessage({
            conversationId: coordConvo.id,
            senderUserId: listingAgentId,
            type: "system",
            content: `Listing agent has ${statusLabel} the offer.`,
          });
          await storage.createNotification({
            userId: agentId,
            type: "offer_response",
            title: `Offer ${statusLabel}`,
            message: `Listing agent has ${statusLabel} the offer.`,
            propertyId: offer.propertyId,
            linkUrl: `/conversations/${coordConvo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(agentId, "offer_response", `Offer ${statusLabel}`, `Listing agent has ${statusLabel} the offer.`, `/conversations/${coordConvo.id}`, offer.propertyId, coordConvo.id);
        }
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/property-offers/:id/buyer-response", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

  const parsedAction = z.object({
    action: z.enum(["accept", "decline", "counter"]),
    counterMessage: z.string().max(5000).optional(),
  }).refine(d => d.action !== "counter" || (d.counterMessage && d.counterMessage.length > 0), {
    message: "counterMessage required for counter action",
  }).safeParse(req.body);
  if (!parsedAction.success) return res.status(400).json({ message: parsedAction.error.errors[0]?.message || "action must be accept, decline, or counter", errors: parsedAction.error.flatten() });
  const { action } = parsedAction.data;
  const counterMessage: string = parsedAction.data.counterMessage ?? "";

  try {
    const result = await executeWithAudit<any>(
      { req, event: "buyer_offer_response", userId, resourceType: "property_offer", resourceId: String(id) },
      async () => {
    const offers = await db.select().from(propertyOffers).where(eq(propertyOffers.id, id));
    const offer = offers[0];
    if (!offer) throw new Error("Offer not found");

    if (offer.buyerUserId !== userId) {
      throw new Error("Only the buyer can respond to this offer");
    }

    const respondableStatuses = ["sent_to_buyer", "viewed"];
    if (!respondableStatuses.includes(offer.status)) {
      throw new Error(`CONFLICT:This offer has already been ${offer.status}. No further action is needed.`);
    }

    const statusMap: Record<string, string> = { accept: "accepted", decline: "declined", counter: "countered" };
    const newStatus = statusMap[action];
    const statusLabel = action === "counter" ? "counter-offered" : newStatus;

    const [updated] = await db.update(propertyOffers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(and(eq(propertyOffers.id, id), or(eq(propertyOffers.status, "sent_to_buyer"), eq(propertyOffers.status, "viewed"))))
      .returning();
    if (!updated) {
      throw new Error(`CONFLICT:This offer has already been responded to.`);
    }

    const assignedAgent = await storage.lookupAssignedAgent(userId);
    if (!assignedAgent) throw new Error("No agent assigned");
    const agentId = assignedAgent.id;

    const buyerUser = await storage.getUser(userId);
    const buyerName = buyerUser?.firstName ? `${buyerUser.firstName} ${buyerUser.lastName || ""}`.trim() : "Buyer";

    const now = new Date();
    await db.update(buyerInterest)
      .set({ stage: "offer_stage", lastActivityAt: now, updatedAt: now })
      .where(and(eq(buyerInterest.propertyId, offer.propertyId), eq(buyerInterest.buyerUserId, userId)));

    const buyerConvo = await storage.getOrCreateConversation(offer.propertyId, userId, agentId, "buyer", "buyer");

    if (action === "counter") {
      await storage.createMessage({
        conversationId: buyerConvo.id,
        senderUserId: userId,
        type: "text",
        content: counterMessage,
      });
      await storage.createMessage({
        conversationId: buyerConvo.id,
        senderUserId: userId,
        type: "system",
        content: `${buyerName} has counter-offered.`,
      });
    } else {
      await storage.createMessage({
        conversationId: buyerConvo.id,
        senderUserId: userId,
        type: "system",
        content: `${buyerName} has ${statusLabel} the offer.`,
      });
    }

    await storage.createNotification({
      userId: agentId,
      type: "offer_response",
      title: `${buyerName} ${statusLabel} the offer`,
      message: action === "counter" ? counterMessage.substring(0, 200) : `The offer has been ${statusLabel}.`,
      propertyId: offer.propertyId,
      linkUrl: `/conversations/${buyerConvo.id}`,
      read: false,
      archived: false,
    });
    trySendNotificationEmail(agentId, "offer_response", `${buyerName} ${statusLabel} the offer`, action === "counter" ? counterMessage.substring(0, 200) : `The offer has been ${statusLabel}.`, `/conversations/${buyerConvo.id}`, offer.propertyId, buyerConvo.id);

    const listingAgentId = offer.listingAgentId;
    if (listingAgentId && listingAgentId !== agentId) {
      const coordConvo = await storage.getOrCreateConversation(offer.propertyId, agentId, listingAgentId, "agent", "agent_coordination", userId);
      const agentName = assignedAgent.firstName ? `${assignedAgent.firstName} ${assignedAgent.lastName || ""}`.trim() : "Buyer's agent";

      if (action === "counter") {
        await storage.createMessage({
          conversationId: coordConvo.id,
          senderUserId: agentId,
          type: "system",
          content: `${agentName}'s client has counter-offered: ${counterMessage.substring(0, 300)}`,
        });
      } else {
        await storage.createMessage({
          conversationId: coordConvo.id,
          senderUserId: agentId,
          type: "system",
          content: `${agentName}'s client has ${statusLabel} the offer.`,
        });
      }

      await storage.createNotification({
        userId: listingAgentId,
        type: "offer_response",
        title: `Buyer has ${statusLabel} the offer`,
        message: action === "counter" ? `Counter: ${counterMessage.substring(0, 200)}` : `The offer has been ${statusLabel}.`,
        propertyId: offer.propertyId,
        linkUrl: `/conversations/${coordConvo.id}`,
        read: false,
        archived: false,
      });
      trySendNotificationEmail(listingAgentId, "offer_response", `Buyer has ${statusLabel} the offer`, action === "counter" ? `Counter: ${counterMessage.substring(0, 200)}` : `The offer has been ${statusLabel}.`, `/conversations/${coordConvo.id}`, offer.propertyId, coordConvo.id);
    }

    return {
          data: { success: true, status: newStatus },
          auditOverrides: { propertyId: offer.propertyId, metadata: { action, newStatus } },
        };
      }
    );
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Offer not found") return res.status(404).json({ message: msg });
    if (msg.includes("Only the buyer")) return res.status(403).json({ message: msg });
    if (msg.startsWith("CONFLICT:")) return res.status(409).json({ message: msg.replace("CONFLICT:", "") });
    if (msg === "No agent assigned") return res.status(400).json({ message: msg });
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

export default router;
