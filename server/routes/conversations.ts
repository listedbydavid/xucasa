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

import { trySendNotificationEmail } from "../lib/notificationHelpers";

async function validateConversationAccess(convo: any, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (convo.buyerUserId !== userId && convo.agentUserId !== userId) {
    return { allowed: false, reason: "You are not a participant in this conversation" };
  }
  const callerUser = await storage.getUser(userId);
  const callerRole = callerUser?.role || "user";
  if (convo.type === "agent_coordination" && callerRole === "user") {
    return { allowed: false, reason: "Buyers cannot access agent coordination threads" };
  }
  if (convo.type === "buyer") {
    const otherUserId = convo.buyerUserId === userId ? convo.agentUserId : convo.buyerUserId;
    const otherUser = await storage.getUser(otherUserId);
    if (callerRole === "user" && otherUser?.role === "user") {
      return { allowed: false, reason: "Buyer-to-buyer conversations are not allowed" };
    }
    if (callerRole === "user") {
      if (!callerUser?.assignedAgentUserId) {
        return { allowed: false, reason: "No agent assigned. Please contact support before messaging." };
      }
      if (callerUser.assignedAgentUserId !== otherUserId) {
        return { allowed: false, reason: "You can only communicate with your assigned agent" };
      }
    }
  }
  return { allowed: true };
}

function sanitizeConversationForCaller(convo: any, callerUserId: string, callerRole: string): any {
  const isListingAgent = convo.type === "agent_coordination" && convo.agentUserId === callerUserId && callerRole !== "admin";
  if (isListingAgent) {
    const { relatedBuyerUserId, ...sanitized } = convo;
    return sanitized;
  }
  return convo;
}

router.get("/api/conversations", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const callerUser = await storage.getUser(userId);
    const callerRole = callerUser?.role || "user";
    const isBuyerRole = callerRole === "user";
    if (isBuyerRole && !callerUser?.assignedAgentUserId) {
      return res.json([]);
    }
    const type = isBuyerRole ? "buyer" : (req.query.type as string | undefined);
    const convos = await storage.getConversationsForUser(userId, type);
    const sanitized = convos.map(c => sanitizeConversationForCaller(c, userId, callerRole));
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/conversations/unread-count", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const callerUser = await storage.getUser(userId);
    if (callerUser?.role === "user" && !callerUser?.assignedAgentUserId) {
      return res.json({ unreadCount: 0 });
    }
    const convos = await storage.getConversationsForUser(userId);
    const total = convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    res.json({ unreadCount: total });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const convo = await storage.getConversation(parseInt(req.params.id));
    if (!convo) return res.status(404).json({ message: "Conversation not found" });
    const access = await validateConversationAccess(convo, userId);
    if (!access.allowed) return res.status(403).json({ message: access.reason });
    const callerUser = await storage.getUser(userId);
    res.json(sanitizeConversationForCaller(convo, userId, callerUser?.role || "user"));
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const createConvoSchema = z.object({
  propertyId: z.number().int().positive(),
  buyerUserId: z.string().min(1).optional(),
  initialMessage: z.string().max(5000).optional(),
  type: z.string().max(50).optional(),
  conversationType: z.enum(["buyer", "agent_coordination"]).optional(),
});

router.post("/api/conversations", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const parsedBody = createConvoSchema.safeParse(req.body);
    if (!parsedBody.success) return res.status(400).json({ message: "Invalid request", errors: parsedBody.error.flatten() });
    const { propertyId, buyerUserId, initialMessage, type: msgType, conversationType } = parsedBody.data;

    const prop = await storage.getProperty(propertyId);
    if (!prop) return res.status(404).json({ message: "Property not found" });

    const callerUser = await storage.getUser(userId);
    const callerRole = callerUser?.role;
    const isAgent = callerRole === "agent" || callerRole === "admin";
    const isBuyer = callerRole === "user";

    let resolvedBuyerId: string;
    let resolvedAgentId: string;
    let convType: string = "buyer";

    if (isBuyer) {
      resolvedBuyerId = userId;
      const assignedAgent = await storage.resolveAndAssignAgent(userId);
      if (!assignedAgent) return res.status(400).json({ message: "No agent assigned. Please contact support." });
      resolvedAgentId = assignedAgent.id;
      convType = "buyer";
    } else if (isAgent) {
      if (conversationType === "agent_coordination") {
        if (!buyerUserId) return res.status(400).json({ message: "buyerUserId required for agent coordination" });

        const buyerUser = await storage.getUser(buyerUserId);
        if (!buyerUser) return res.status(404).json({ message: "Buyer not found" });
        if (buyerUser.assignedAgentUserId !== userId) {
          return res.status(403).json({ message: "You are not the assigned agent for this buyer" });
        }

        const listingAgentId = prop.agentId;
        if (!listingAgentId) {
          return res.status(400).json({ message: "No listing agent for this property" });
        }
        if (listingAgentId === userId) {
          return res.status(400).json({ message: "You are already the listing agent for this property. Use a buyer conversation instead." });
        }
        resolvedBuyerId = userId;
        resolvedAgentId = listingAgentId;
        convType = "agent_coordination";
      } else {
        if (!buyerUserId) return res.status(400).json({ message: "buyerUserId required when agent creates conversation" });

        const buyerUser = await storage.getUser(buyerUserId);
        if (!buyerUser) return res.status(404).json({ message: "Buyer not found" });

        if (!buyerUser.assignedAgentUserId) {
          return res.status(403).json({ message: "This buyer has no assigned agent. Assignment happens through buyer-initiated flows." });
        }
        if (buyerUser.assignedAgentUserId !== userId) {
          return res.status(403).json({ message: "You are not the assigned agent for this buyer" });
        }

        resolvedBuyerId = buyerUserId;
        resolvedAgentId = userId;
        convType = "buyer";
      }
    } else {
      return res.status(403).json({ message: "Invalid role for conversation creation" });
    }

    const convoResult = await executeWithAudit(
      { req, event: "conversation_created", userId, propertyId, metadata: { type: convType } },
      async () => {
        const actualBuyerIdForInterest = (convType === "agent_coordination" && buyerUserId) ? buyerUserId : resolvedBuyerId;
        await storage.upsertBuyerInterest(propertyId, actualBuyerIdForInterest, msgType || "inquiry", isAgent ? userId : resolvedAgentId, prop.agentId ?? undefined);

        const relatedBuyer = (convType === "agent_coordination" && buyerUserId) ? buyerUserId : undefined;
        const convo = await storage.getOrCreateConversation(propertyId, resolvedBuyerId, resolvedAgentId, isAgent ? "agent" : "buyer", convType, relatedBuyer);
        await audit({ req, event: "conversation_created", outcome: "success", userId, propertyId, conversationId: convo.id, metadata: { convType } });

        if (initialMessage) {
          await storage.createMessage({
            conversationId: convo.id,
            senderUserId: userId,
            type: msgType || "text",
            content: initialMessage,
          });

          const recipientId = isAgent && convType !== "agent_coordination" ? resolvedBuyerId : resolvedAgentId;
          const senderName = callerUser?.firstName ? `${callerUser.firstName} ${callerUser.lastName || ""}`.trim() : (isAgent ? "Your agent" : "A buyer");
          await storage.createNotification({
            userId: recipientId,
            type: "message_received",
            title: `New message from ${senderName}`,
            message: initialMessage.substring(0, 200),
            propertyId,
            linkUrl: `/conversations/${convo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(recipientId, "message_received", `New message from ${senderName}`, initialMessage.substring(0, 200), `/conversations/${convo.id}`, propertyId, convo.id);
        }

        if (convType === "agent_coordination") {
          audit({ req, event: "coordination_thread_created", outcome: "success", userId, propertyId, conversationId: convo.id });
        }

        return { data: convo, auditOverrides: { conversationId: convo.id } };
      }
    );
    res.status(201).json(sanitizeConversationForCaller(convoResult, userId, callerRole || "user"));
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch("/api/conversations/:id/read", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const conversationId = parseInt(req.params.id);
    const convo = await storage.getConversation(conversationId);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });
    const access = await validateConversationAccess(convo, userId);
    if (!access.allowed) return res.status(403).json({ message: access.reason });
    const role = convo.buyerUserId === userId ? 'buyer' : 'agent';
    await storage.updateConversationReadAt(conversationId, userId, role);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const conversationId = parseInt(req.params.id);
    const convo = await storage.getConversation(conversationId);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });
    const access = await validateConversationAccess(convo, userId);
    if (!access.allowed) return res.status(403).json({ message: access.reason });

    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before ? parseInt(req.query.before as string) : undefined;
    const msgs = await storage.getMessagesForConversation(conversationId, limit, before);

    const role = convo.buyerUserId === userId ? 'buyer' : 'agent';
    await storage.updateConversationReadAt(conversationId, userId, role);

    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
  try {
  const userId = req.user.claims.sub;
  const conversationId = parseInt(req.params.id);
  const convo = await storage.getConversation(conversationId);
  if (!convo) return res.status(404).json({ message: "Conversation not found" });
  const access = await validateConversationAccess(convo, userId);
  if (!access.allowed) {
    audit({ req, event: "authorization_denied", outcome: "failure", userId, conversationId, metadata: { reason: access.reason, action: "send_message" } });
    return res.status(403).json({ message: access.reason });
  }

  const { content, type } = req.body;
  if (!content) return res.status(400).json({ message: "content required" });

  const result = await executeWithAudit(
      { req, event: "message_sent", userId, conversationId, propertyId: convo.propertyId, metadata: { type: type || "text" } },
      async () => {
        const msg = await storage.createMessage({
          conversationId,
          senderUserId: userId,
          type: type || "text",
          content,
        });

        const role = convo.buyerUserId === userId ? 'buyer' : 'agent';
        await storage.updateConversationReadAt(conversationId, userId, role);

        const recipientId = convo.buyerUserId === userId ? convo.agentUserId : convo.buyerUserId;
        const sender = await storage.getUser(userId);
        const senderName = sender?.firstName ? `${sender.firstName} ${sender.lastName || ""}`.trim() : "Someone";
        await storage.createNotification({
          userId: recipientId,
          type: "message_received",
          title: `New message from ${senderName}`,
          message: content.substring(0, 200),
          propertyId: convo.propertyId,
          linkUrl: `/conversations/${conversationId}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(recipientId, "message_received", `New message from ${senderName}`, content.substring(0, 200), `/conversations/${conversationId}`, convo.propertyId, conversationId);

        return { data: { ...msg, sender } };
      }
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/api/showing-requests", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const callerUser = await storage.getUser(userId);
    const requests = await storage.getShowingRequestsForUser(userId);
    const sanitized = requests.map(r => {
      const isListingAgentOnThis = r.property?.agentId === userId && r.agentUserId !== userId;
      if (isListingAgentOnThis && callerUser?.role !== "admin") {
        const { buyer, buyerUserId, ...rest } = r as any;
        return { ...rest, buyerUserId: "[redacted]", buyer: null };
      }
      return r;
    });
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/showing-requests", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { propertyId, requestedDates, notes } = req.body;
  if (!propertyId || !requestedDates || !Array.isArray(requestedDates) || requestedDates.length === 0) {
    return res.status(400).json({ message: "propertyId and requestedDates required" });
  }

  try {
    const result = await executeWithAudit(
      { req, event: "showing_request_created", userId, propertyId },
      async () => {
        const prop = await storage.getProperty(propertyId);
        if (!prop) throw new Error("Property not found");

        const assignedAgent = await storage.resolveAndAssignAgent(userId);
        if (!assignedAgent) throw new Error("No agent assigned");
        const agentId = assignedAgent.id;

        await storage.upsertBuyerInterest(propertyId, userId, "showing_request", agentId, prop.agentId ?? undefined);
        const convo = await storage.getOrCreateConversation(propertyId, userId, agentId, "buyer", "buyer");

        const request = await storage.createShowingRequest({
          conversationId: convo.id,
          propertyId,
          buyerUserId: userId,
          agentUserId: agentId,
          requestedDates,
          notes: notes || null,
        });

        const buyer = await storage.getUser(userId);
        const buyerName = buyer?.firstName ? `${buyer.firstName} ${buyer.lastName || ""}`.trim() : "A buyer";
        const dateStr = requestedDates.slice(0, 2).join(", ");
        await storage.createMessage({
          conversationId: convo.id,
          senderUserId: userId,
          type: "showing_request",
          content: `Showing request for ${dateStr}${notes ? ` — ${notes}` : ""}`,
          metadata: { showingRequestId: request.id, requestedDates },
        });

        await storage.createNotification({
          userId: agentId,
          type: "showing_request",
          title: `Showing request from ${buyerName}`,
          message: `Requested dates: ${dateStr}`,
          propertyId,
          linkUrl: `/conversations/${convo.id}`,
          read: false,
          archived: false,
        });
        trySendNotificationEmail(agentId, "showing_request", `Showing request from ${buyerName}`, `Requested dates: ${dateStr}`, `/conversations/${convo.id}`, propertyId, convo.id);

        return {
          data: request,
          auditOverrides: { conversationId: convo.id, resourceType: "showing_request", resourceId: String(request.id) },
        };
      }
    );
    res.status(201).json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Property not found") return res.status(404).json({ message: msg });
    if (msg === "No agent assigned") return res.status(400).json({ message: msg });
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch("/api/showing-requests/:id", isAuthenticated, async (req: any, res) => {
  try {
  const userId = req.user.claims.sub;
  const id = parseInt(req.params.id);
  const { status, confirmedDate } = req.body;
  if (!status) return res.status(400).json({ message: "status required" });

  const existing = await storage.getShowingRequest(id);
  if (!existing) return res.status(404).json({ message: "Showing request not found" });

  const prop = await storage.getProperty(existing.propertyId);
  const isAssignedAgent = existing.agentUserId === userId;
  const isBuyerUser = existing.buyerUserId === userId;
  const isListingAgent = prop?.agentId === userId;

  if (!isAssignedAgent && !isBuyerUser && !isListingAgent) {
    audit({ req, event: "authorization_denied", outcome: "failure", userId, resourceType: "showing_request", resourceId: String(id), metadata: { reason: "not_participant" } });
    return res.status(403).json({ message: "Access denied" });
  }

  const currentStatus = existing.status;

  const validTransitions: Record<string, Record<string, string[]>> = {
    assignedAgent: {
      requested: ["under_review"],
      under_review: ["sent_to_listing_agent"],
      sent_to_listing_agent: [],
      confirmed: ["completed"],
      alternate_proposed: ["under_review", "sent_to_listing_agent"],
      declined: [],
      completed: [],
      cancelled: [],
    },
    listingAgent: {
      sent_to_listing_agent: ["confirmed", "alternate_proposed", "declined"],
      confirmed: ["completed"],
      alternate_proposed: [],
      declined: [],
      completed: [],
    },
    buyer: {
      requested: ["cancelled"],
      under_review: ["cancelled"],
      sent_to_listing_agent: ["cancelled"],
    },
  };

  let allowedNext: string[] = [];
  if (isAssignedAgent) {
    allowedNext = [...allowedNext, ...(validTransitions.assignedAgent[currentStatus] || [])];
  }
  if (isListingAgent) {
    allowedNext = [...allowedNext, ...(validTransitions.listingAgent[currentStatus] || [])];
  }
  if (isBuyerUser) {
    allowedNext = [...allowedNext, ...(validTransitions.buyer[currentStatus] || [])];
  }
  allowedNext = [...new Set(allowedNext)];

  if (!allowedNext.includes(status)) {
    return res.status(403).json({ message: `Cannot transition from '${currentStatus}' to '${status}' with your role. Allowed: ${allowedNext.join(", ") || "none"}` });
  }

  const roleLabel = isListingAgent ? "listing_agent" : isAssignedAgent ? "assigned_agent" : "buyer";
    const result = await executeWithAudit(
      { req, event: "showing_status_changed", userId, propertyId: existing.propertyId, resourceType: "showing_request", resourceId: String(id), metadata: { from: currentStatus, to: status, role: roleLabel } },
      async () => {
        const updated = await storage.updateShowingRequestStatus(
          id,
          status,
          confirmedDate ? new Date(confirmedDate) : undefined,
        );

        if (status === "confirmed") {
          const now = new Date();
          await db.update(buyerInterest)
            .set({ stage: "showing_scheduled", lastActivityAt: now, updatedAt: now })
            .where(and(eq(buyerInterest.propertyId, updated.propertyId), eq(buyerInterest.buyerUserId, updated.buyerUserId)));
        }

        const statusMsg = status === "confirmed"
          ? `Showing confirmed${confirmedDate ? ` for ${new Date(confirmedDate).toLocaleDateString()}` : ""}`
          : status === "alternate_proposed"
          ? `Alternate date proposed${confirmedDate ? `: ${new Date(confirmedDate).toLocaleDateString()}` : ""}`
          : `Showing ${(status || "").replace(/_/g, " ")}`;

        if (isAssignedAgent && status === "sent_to_listing_agent" && prop?.agentId && prop.agentId !== userId) {
          const listingAgentId = prop.agentId;
          const coordConvo = await storage.getOrCreateConversation(
            updated.propertyId, userId, listingAgentId, "agent", "agent_coordination", updated.buyerUserId
          );
          audit({ req, event: "coordination_thread_created", outcome: "success", userId, propertyId: updated.propertyId, conversationId: coordConvo.id, metadata: { trigger: "showing_forwarded" } });

          const agentUser = await storage.getUser(userId);
          const agentName = agentUser?.firstName ? `${agentUser.firstName} ${agentUser.lastName || ""}`.trim() : "Buyer's agent";
          const dateStr = existing.requestedDates
            ? (Array.isArray(existing.requestedDates) ? (existing.requestedDates as string[]).slice(0, 2).join(", ") : "")
            : "";
          await storage.createMessage({
            conversationId: coordConvo.id,
            senderUserId: userId,
            type: "showing_request",
            content: `Showing request from ${agentName} for a buyer — Requested dates: ${dateStr}${existing.notes ? ` — ${existing.notes}` : ""}`,
            metadata: { showingRequestId: id, requestedDates: existing.requestedDates },
          });

          await storage.createNotification({
            userId: listingAgentId,
            type: "showing_request",
            title: `New showing request from ${agentName}`,
            message: `Requested dates: ${dateStr}`,
            propertyId: updated.propertyId,
            linkUrl: `/conversations/${coordConvo.id}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(listingAgentId, "showing_request", `New showing request from ${agentName}`, `Requested dates: ${dateStr}`, `/conversations/${coordConvo.id}`, updated.propertyId, coordConvo.id);

          const buyerConvoId = updated.conversationId;
          if (buyerConvoId) {
            await storage.createMessage({
              conversationId: buyerConvoId,
              senderUserId: userId,
              type: "system",
              content: "Your agent is coordinating with the listing agent for this showing",
            });
          }
        }

        if (isListingAgent && !isAssignedAgent) {
          const biRecord = await db.select().from(buyerInterest)
            .where(and(eq(buyerInterest.propertyId, updated.propertyId), eq(buyerInterest.buyerUserId, updated.buyerUserId)))
            .limit(1);
          const coordConvoId = biRecord[0]?.agentCoordinationConversationId;
          const buyerConvoId = biRecord[0]?.buyerConversationId || updated.conversationId;
          if (coordConvoId) {
            await storage.createMessage({
              conversationId: coordConvoId,
              senderUserId: userId,
              type: "system",
              content: statusMsg,
            });
          }
          const sender = await storage.getUser(userId);
          const senderName = sender?.firstName || "Listing Agent";
          const notificationType = status === "confirmed" ? "showing_confirmed" : status === "declined" ? "showing_declined" : "showing_update";
          const notifTitle = `Showing ${(status || "").replace(/_/g, " ")}`;
          const notifMsg = confirmedDate ? `Confirmed for ${new Date(confirmedDate).toLocaleDateString()}` : `Showing has been ${(status || "").replace(/_/g, " ")}`;

          await storage.createNotification({
            userId: updated.agentUserId,
            type: notificationType,
            title: `${notifTitle} by ${senderName}`,
            message: notifMsg,
            propertyId: updated.propertyId,
            linkUrl: coordConvoId ? `/conversations/${coordConvoId}` : undefined,
            read: false,
            archived: false,
          });
          if (coordConvoId) {
            trySendNotificationEmail(updated.agentUserId, notificationType, `${notifTitle} by ${senderName}`, notifMsg, `/conversations/${coordConvoId}`, updated.propertyId, coordConvoId);
          }

          if (buyerConvoId && ["confirmed", "declined", "completed"].includes(status)) {
            await storage.createMessage({
              conversationId: buyerConvoId,
              senderUserId: updated.agentUserId,
              type: "system",
              content: statusMsg,
            });
            await storage.createNotification({
              userId: updated.buyerUserId,
              type: notificationType,
              title: notifTitle,
              message: notifMsg,
              propertyId: updated.propertyId,
              linkUrl: `/conversations/${buyerConvoId}`,
              read: false,
              archived: false,
            });
            trySendNotificationEmail(updated.buyerUserId, notificationType, notifTitle, notifMsg, `/conversations/${buyerConvoId}`, updated.propertyId, buyerConvoId);
          }
        } else {
          if (updated.conversationId) {
            await storage.createMessage({
              conversationId: updated.conversationId,
              senderUserId: userId,
              type: "system",
              content: statusMsg,
            });
          }
          const recipientId = updated.buyerUserId === userId ? updated.agentUserId : updated.buyerUserId;
          const sender = await storage.getUser(userId);
          const senderName = sender?.firstName || "Agent";
          const notificationType = status === "confirmed" ? "showing_confirmed" : status === "declined" ? "showing_declined" : "showing_update";
          const notifTitle = `Showing ${(status || "").replace(/_/g, " ")} by ${senderName}`;
          const notifMsg = confirmedDate ? `Confirmed for ${new Date(confirmedDate).toLocaleDateString()}` : `Showing has been ${(status || "").replace(/_/g, " ")}`;
          await storage.createNotification({
            userId: recipientId,
            type: notificationType,
            title: notifTitle,
            message: notifMsg,
            propertyId: updated.propertyId,
            linkUrl: `/conversations/${updated.conversationId}`,
            read: false,
            archived: false,
          });
          trySendNotificationEmail(recipientId, notificationType, notifTitle, notifMsg, `/conversations/${updated.conversationId}`, updated.propertyId, updated.conversationId);
        }

        return { data: updated };
      }
    );

    if (isListingAgent && !isAssignedAgent) {
      const { buyerUserId: _b, ...sanitizedUpdated } = result as any;
      res.json({ ...sanitizedUpdated, buyerUserId: "[redacted]" });
    } else {
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", requestId: req.requestId });
  }
});

export default router;
