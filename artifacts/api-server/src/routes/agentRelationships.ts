/**
 * agentRelationships.ts
 *
 * Implements Task #32 — Protect agent relationships and listing sharing.
 *
 * Routes:
 *   GET  /api/properties/:id/contact-agent       — public, agent contact card
 *   GET  /api/properties/:id                      — stores ?agent= referral in session (patched on existing handler)
 *   POST /api/agent/send-listing                  — verified agent sends listing to client
 *   GET  /api/agent/listing-share-url/:propertyId — verified agent gets shareable URL
 *   GET  /api/agents/search                        — authenticated buyer searches verified agents
 *   POST /api/buyer/link-agent                    — authenticated buyer links a verified agent
 *   GET  /api/buyer/my-agent                      — authenticated buyer gets their agent
 *
 * Central invariant (enforced here and in assignPlatformAgentIfNeeded):
 *   A buyer with assignedAgentUserId set to a real agent (!= DAVID_USER_ID)
 *   is NEVER overwritten automatically, by listing agent data, or referral link.
 */

import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth/authGuard";
import { storage, DAVID_USER_ID } from "../storage";
import { db } from "../db";
import { users, savedProperties, sellLeads, properties } from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { audit, executeWithAudit } from "../auditLog";
import { authStorage } from "../replit_integrations/auth/storage";
import { assignPlatformAgentIfNeeded } from "../lib/assignPlatformAgent";
import { createListingShareToken } from "../lib/listingShareAccess";
import { hasListingShareAccess } from "../lib/listingShareAccess";
import { isDraftProperty } from "../lib/propertyVisibility";
import { rateLimit } from "express-rate-limit";

const router = Router();
const guestLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many inquiries. Please try again later." },
});

// ── Safe public agent shape ──────────────────────────────────────────────────

function safeAgentFields(agent: any) {
  if (!agent) return null;
  return {
    id: String(agent.id),
    firstName: agent.firstName ?? "Agent",
    lastName: agent.lastName ?? "",
    email: agent.email ?? "",
    phone: agent.phone ?? null,
    profileImageUrl: agent.profileImageUrl ?? null,
    brokerageName: agent.brokerageName ?? null,
    agentMlsId: agent.agentMlsId ?? null,
  };
}

export function getTrustedShareOrigin(): string | null {
  const trustedDevelopmentOrigin =
    process.env.NODE_ENV !== "production" && process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined;
  const configuredOrigin =
    process.env.FRONTEND_ORIGIN ||
    process.env.PUBLIC_ORIGIN ||
    process.env.APP_URL ||
    trustedDevelopmentOrigin;

  if (!configuredOrigin) return null;

  try {
    const parsed = new URL(configuredOrigin);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

function getTrustedShareBaseUrl(): URL | null {
  const trustedDevelopmentUrl =
    process.env.NODE_ENV !== "production" && process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/`
      : undefined;
  const configuredUrl =
    process.env.FRONTEND_ORIGIN ||
    process.env.PUBLIC_ORIGIN ||
    process.env.APP_URL ||
    trustedDevelopmentUrl;
  if (!configuredUrl) return null;
  try {
    const parsed = new URL(configuredUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
    return parsed;
  } catch {
    return null;
  }
}

type ContactAgentType = "buyers_agent" | "listing_agent" | "platform_agent";

interface ContactAgentResolution {
  agentType: ContactAgentType;
  agent: any;
  notificationAgent: any | null;
}

async function resolvePropertyContactAgent(
  req: any,
  prop: any,
  propertyId: number,
): Promise<ContactAgentResolution | null> {
  const isAuthenticated = req.isAuthenticated?.() && req.user?.claims?.sub;
  const buyerUserId: string | null = isAuthenticated ? req.user.claims.sub : null;

  if (buyerUserId) {
    const buyer = await storage.getUser(buyerUserId);
    const assignedId = buyer?.assignedAgentUserId;
    if (assignedId && assignedId !== DAVID_USER_ID) {
      const assignedAgent = await storage.getUser(assignedId);
      if (assignedAgent) {
        return {
          agentType: "buyers_agent",
          agent: assignedAgent,
          notificationAgent: assignedAgent,
        };
      }
    }

    await assignPlatformAgentIfNeeded(buyerUserId, req, "property_view");

    // A buyer-selected link may have won a concurrent assignment race.
    const buyerAfterAssignment = await storage.getUser(buyerUserId);
    const assignedAfterRace = buyerAfterAssignment?.assignedAgentUserId;
    if (assignedAfterRace && assignedAfterRace !== DAVID_USER_ID) {
      const assignedAgent = await storage.getUser(assignedAfterRace);
      if (assignedAgent) {
        return {
          agentType: "buyers_agent",
          agent: assignedAgent,
          notificationAgent: assignedAgent,
        };
      }
    }
  }

  const sessionReferring: string | undefined = req.session?.referringAgentId;
  const sessionPropertyId: number | undefined = req.session?.referredPropertyId;
  if (sessionReferring && sessionPropertyId === propertyId) {
    const referringAgent = await storage.getUser(sessionReferring);
    if (referringAgent?.agentVerified && referringAgent.role === "agent") {
      return {
        agentType: "listing_agent",
        agent: referringAgent,
        notificationAgent: referringAgent,
      };
    }
  }

  if (prop.agentId) {
    const listingAgent = await storage.getUser(prop.agentId);
    if (listingAgent) {
      return {
        agentType: "listing_agent",
        agent: listingAgent,
        notificationAgent: listingAgent,
      };
    }
  }

  if (prop.listingAgentEmail) {
    const [listingAgent] = await db
      .select()
      .from(users)
      .where(eq(users.email, prop.listingAgentEmail))
      .limit(1);
    if (listingAgent) {
      return {
        agentType: "listing_agent",
        agent: listingAgent,
        notificationAgent: listingAgent,
      };
    }
  }

  const david = await storage.getUser(DAVID_USER_ID);

  if (prop.listingAgentName || prop.listingAgentEmail || prop.listingAgentPhone) {
    const listingAgentName = prop.listingAgentName?.trim() || "Listing Agent";
    return {
      agentType: "listing_agent",
      agent: {
        id: `listing:${propertyId}`,
        firstName: listingAgentName.split(" ")[0] || "Listing",
        lastName: listingAgentName.split(" ").slice(1).join(" "),
        email: prop.listingAgentEmail ?? "",
        phone: prop.listingAgentPhone ?? null,
        profileImageUrl: null,
        brokerageName: prop.listingBrokerage ?? null,
        agentMlsId: prop.listingAgentMlsId ?? null,
      },
      // A raw MLS contact has no Xucasa user ID for in-app delivery. David
      // receives the platform notification so the inquiry is not dropped.
      notificationAgent: david,
    };
  }

  return david
    ? { agentType: "platform_agent", agent: david, notificationAgent: david }
    : null;
}

// ── GET /api/properties/:id/contact-agent ────────────────────────────────────
// Public — no auth required.
// Resolution priority for unrepresented/guest:
//   1. referring agent from session (set when ?agent= was on the property page)
//   2. listing agent from property record
//   3. David Hussain (platform agent)

router.get("/api/properties/:id/contact-agent", async (req: any, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid property ID" });
      return;
    }

    const prop = await storage.getProperty(id);
    if (!prop || isDraftProperty(prop)) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    if (!hasListingShareAccess(req, prop)) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    const resolution = await resolvePropertyContactAgent(req, prop, id);
    if (!resolution) {
      res.status(404).json({ message: "No agent information available" });
      return;
    }

    res.json({
      agentType: resolution.agentType,
      agent: safeAgentFields(resolution.agent),
    });
  } catch (err) {
    req.log?.error({ event: "contact_agent_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ── POST /api/properties/:id/tour-inquiry ────────────────────────────────────
// Public — no auth required. Creates a sell_lead and notifies the displayed agent.

router.post("/api/properties/:id/tour-inquiry", guestLeadLimiter, async (req: any, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid property ID" });
      return;
    }

    const parsed = z.object({
      name: z.string().trim().min(1, "Name is required").max(200),
      email: z.string().email().max(200).optional().nullable(),
      phone: z.string().max(30).optional().nullable(),
      preferredDate: z.string().max(100).optional().nullable(),
      message: z.string().max(2000).optional().nullable(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid request", errors: parsed.error.flatten() });
      return;
    }

    const { name, email, phone, preferredDate, message } = parsed.data;

    // Validate: at least one contact method (email or phone)
    if (!email && !phone) {
      res.status(400).json({ message: "Please provide an email address or phone number" });
      return;
    }

    const prop = await storage.getProperty(id);
    if (!prop || isDraftProperty(prop)) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    if (!hasListingShareAccess(req, prop)) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    // Create sell_lead record (email is required by schema; use placeholder if only phone given)
    const propAddress = prop.title ?? prop.location ?? `Property #${id}`;
    await storage.createSellLead({
      name,
      email: email ?? `noemail+${Date.now()}@xucasa.com`,
      phone: phone ?? null,
      fullAddress: propAddress,
      agentNote: [
        `Tour inquiry for: ${propAddress}`,
        preferredDate ? `Preferred date: ${preferredDate}` : null,
        message ?? null,
      ].filter(Boolean).join("\n") || null,
    } as any);

    const resolution = await resolvePropertyContactAgent(req, prop, id);
    const notifyAgent = resolution?.notificationAgent;
    const agentFirstName = resolution?.agent?.firstName ?? "Your agent";

    if (notifyAgent?.id) {
      await storage.createNotification({
        userId: notifyAgent.id,
        type: "tour_inquiry",
        title: `Tour request from ${name}`,
        message: `${name} wants to tour ${propAddress}${preferredDate ? ` on ${preferredDate}` : ""}${email ? ` · ${email}` : ""}${phone ? ` · ${phone}` : ""}`,
        propertyId: id,
        linkUrl: `/property/${id}`,
        read: false,
        archived: false,
      });
    }

    await audit({
      req,
      event: "tour_inquiry_created",
      outcome: "success",
      propertyId: id,
      metadata: { hasEmail: !!email, hasPhone: !!phone, agentId: notifyAgent?.id ?? null },
    });

    res.json({ success: true, message: `Request sent! ${agentFirstName} will be in touch soon.` });
  } catch (err) {
    req.log?.error({ event: "tour_inquiry_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Public basic question form. Guests can contact the displayed agent without
// creating an account; account-only conversation messaging remains protected.
router.post("/api/properties/:id/question-inquiry", guestLeadLimiter, async (req: any, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid property ID" });
      return;
    }
    const parsed = z.object({
      name: z.string().trim().min(1, "Name is required").max(200),
      email: z.string().trim().email().max(200).optional().nullable(),
      phone: z.string().trim().max(30).optional().nullable(),
      message: z.string().trim().min(1, "Question is required").max(2000),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid request" });
      return;
    }
    if (!parsed.data.email && !parsed.data.phone) {
      res.status(400).json({ message: "Please provide an email address or phone number" });
      return;
    }
    const prop = await storage.getProperty(id);
    if (!prop || isDraftProperty(prop) || !hasListingShareAccess(req, prop)) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    const propAddress = prop.title ?? prop.location ?? `Property #${id}`;
    await storage.createSellLead({
      name: parsed.data.name,
      email: parsed.data.email ?? `noemail+${Date.now()}@xucasa.com`,
      phone: parsed.data.phone ?? null,
      fullAddress: propAddress,
      agentNote: `Listing question for: ${propAddress}\n${parsed.data.message}`,
    } as any);
    const resolution = await resolvePropertyContactAgent(req, prop, id);
    const notifyAgent = resolution?.notificationAgent;
    if (notifyAgent?.id) {
      await storage.createNotification({
        userId: notifyAgent.id,
        type: "listing_question",
        title: `Listing question from ${parsed.data.name}`,
        message: `${parsed.data.message}${parsed.data.email ? ` · ${parsed.data.email}` : ""}${parsed.data.phone ? ` · ${parsed.data.phone}` : ""}`,
        propertyId: id,
        linkUrl: `/property/${id}`,
        read: false,
        archived: false,
      });
    }
    await audit({
      req,
      event: "listing_question_created",
      outcome: "success",
      propertyId: id,
      metadata: {
        hasEmail: !!parsed.data.email,
        hasPhone: !!parsed.data.phone,
        agentId: notifyAgent?.id ?? null,
      },
    });
    res.json({ success: true, message: "Your question was sent to the agent." });
  } catch (err) {
    req.log?.error({ event: "listing_question_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ── POST /api/agent/send-listing ─────────────────────────────────────────────
// Verified agent sends a listing to a linked client.

router.post("/api/agent/send-listing", isAuthenticated, async (req: any, res): Promise<void> => {
  try {
    const agentUserId = req.user.claims.sub;

    // Verify agent is verified
    const agentUser = await authStorage.getUser(agentUserId);
    if (!agentUser || agentUser.role !== "agent" || !agentUser.agentVerified) {
      res.status(403).json({ message: "Verified agent access required" });
      return;
    }

    const parsed = z.object({
      clientUserId: z.string().min(1),
      propertyId: z.number().int().positive(),
      note: z.string().max(200).optional().nullable(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid request", errors: parsed.error.flatten() });
      return;
    }

    const { clientUserId, propertyId, note } = parsed.data;

    // Verify client is linked to this agent
    const client = await storage.getUser(clientUserId);
    if (!client) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    // assignedAgentUserId is authoritative. Historical client-link rows are a
    // dashboard projection and must never grant access when they disagree.
    if (client.assignedAgentUserId !== agentUserId) {
      res.status(403).json({ message: "This client is not linked to your account" });
      return;
    }

    // Verify property exists
    const prop = await storage.getProperty(propertyId);
    if (!prop) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    if (isDraftProperty(prop)) {
      res.status(409).json({ message: "Publish this draft before sending it to a client" });
      return;
    }
    if (!hasListingShareAccess(req, prop)) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    await executeWithAudit(
      {
        req,
        event: "listing_sent_to_client",
        userId: agentUserId,
        role: "agent",
        propertyId,
        metadata: { clientUserId, note: note ?? null },
      },
      async () => {
        // Upsert saved property — skip if already saved
        await db
          .insert(savedProperties)
          .values({ userId: clientUserId, propertyId, listId: null })
          .onConflictDoNothing({ target: [savedProperties.userId, savedProperties.propertyId] });

        const propAddress = prop.title ?? prop.location ?? `Property #${propertyId}`;
        const notifMessage = note
          ? `Check out ${propAddress}: ${note}`
          : `Check out ${propAddress}`;

        await storage.createNotification({
          userId: clientUserId,
          type: "agent_listing_share",
          title: `${agentUser.firstName ?? "Your agent"} sent you a listing`,
          message: notifMessage,
          propertyId,
          linkUrl: `/property/${propertyId}`,
          read: false,
          archived: false,
        });

        return {
          data: null,
          auditOverrides: { metadata: { clientUserId, propertyId, note: note ?? null } },
        };
      }
    );

    const clientFirstName = client.firstName ?? "your client";
    res.json({ success: true, message: `Listing sent to ${clientFirstName}` });
  } catch (err) {
    req.log?.error({ event: "send_listing_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ── GET /api/agent/listing-share-url/:propertyId ─────────────────────────────
// Verified agent gets a shareable URL for a listing.

router.get("/api/agent/listing-share-url/:propertyId", isAuthenticated, async (req: any, res): Promise<void> => {
  try {
    const agentUserId = req.user.claims.sub;

    const agentUser = await authStorage.getUser(agentUserId);
    if (!agentUser || agentUser.role !== "agent" || !agentUser.agentVerified) {
      res.status(403).json({ message: "Verified agent access required" });
      return;
    }

    const propertyId = parseInt(
      Array.isArray(req.params.propertyId) ? req.params.propertyId[0] : req.params.propertyId,
      10
    );
    if (isNaN(propertyId)) {
      res.status(400).json({ message: "Invalid property ID" });
      return;
    }

    const prop = await storage.getProperty(propertyId);
    if (!prop) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    if (isDraftProperty(prop)) {
      res.status(409).json({ message: "Publish this draft before sharing it" });
      return;
    }

    const ownsListing = prop.agentId === agentUserId
      || (!!agentUser.email && !!prop.listingAgentEmail
        && prop.listingAgentEmail.toLowerCase() === agentUser.email.toLowerCase())
      || (!!agentUser.agentMlsId && prop.listingAgentMlsId === agentUser.agentMlsId);
    if (!ownsListing) {
      res.status(403).json({ message: "You can only create share links for your own listings" });
      return;
    }

    const shareBaseUrl = getTrustedShareBaseUrl();
    if (!shareBaseUrl) {
      res.status(503).json({ message: "Listing share links are not configured" });
      return;
    }

    const shareUrl = new URL(`property/${propertyId}`, shareBaseUrl);
    shareUrl.searchParams.set("agent", agentUserId);
    shareUrl.searchParams.set("shareToken", createListingShareToken(prop));

    await audit({
      req,
      event: "listing_share_url_generated",
      outcome: "success",
      userId: agentUserId,
      propertyId,
      metadata: { sharePath: `/property/${propertyId}`, includesPrivateAccessToken: true },
    });

    res.json({ shareUrl: shareUrl.toString() });
  } catch (err) {
    req.log?.error({ event: "listing_share_url_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ── GET /api/agents/search ───────────────────────────────────────────────────
// Authenticated. Search verified agents by name/email/brokerage.

router.get("/api/agents/search", isAuthenticated, async (req: any, res): Promise<void> => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? "";
    if (q.length < 2) {
      res.status(400).json({ message: "Search query must be at least 2 characters" });
      return;
    }

    const pattern = `%${q}%`;
    const rows = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.agentVerified, true),
          eq(users.role, "agent"),
          or(
            ilike(users.firstName, pattern),
            ilike(users.lastName, pattern),
            ilike(users.email, pattern),
            ilike(users.brokerageName, pattern),
          ),
        ),
      )
      .limit(10);

    const agents = rows.map((u) => ({
      id: u.id,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      email: u.email ?? null,
      phone: u.phone ?? null,
      profileImageUrl: u.profileImageUrl ?? null,
      brokerageName: u.brokerageName ?? null,
      agentMlsId: u.agentMlsId ?? null,
    }));

    res.json({ agents });
  } catch (err) {
    req.log?.error({ event: "agents_search_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ── POST /api/buyer/link-agent ───────────────────────────────────────────────
// Authenticated buyer links a verified agent.

router.post("/api/buyer/link-agent", isAuthenticated, async (req: any, res): Promise<void> => {
  try {
    const buyerUserId = req.user.claims.sub;

    const parsed = z.object({
      agentUserId: z.string().min(1),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: "agentUserId is required" });
      return;
    }

    const { agentUserId } = parsed.data;

    // Verify agent is real and verified
    const agentUser = await storage.getUser(agentUserId);
    if (!agentUser || agentUser.role !== "agent" || !agentUser.agentVerified) {
      res.status(404).json({ message: "Verified agent not found" });
      return;
    }

    const buyer = await storage.getUser(buyerUserId);
    const currentAssigned = buyer?.assignedAgentUserId;

    // Central invariant: only replace David or no-agent
    if (currentAssigned && currentAssigned !== DAVID_USER_ID) {
      res.status(409).json({
        message: "You already have an agent linked. Contact support to update.",
      });
      return;
    }

    const assigned = await storage.assignAgent(buyerUserId, agentUserId);
    if (!assigned) {
      res.status(409).json({
        message: "You already have an agent linked. Contact support to update.",
      });
      return;
    }

    await executeWithAudit(
      {
        req,
        event: "buyer_agent_linked",
        userId: buyerUserId,
        role: "buyer",
        metadata: {
          agentUserId,
          assignmentType: "buyer_initiated",
          previousAgentId: currentAssigned ?? null,
        },
      },
      async () => {
        // Notify the new agent
        const buyerName = buyer?.firstName
          ? `${buyer.firstName}${buyer.lastName ? " " + buyer.lastName : ""}`
          : "A buyer";
        await storage.createNotification({
          userId: agentUserId,
          type: "new_client_linked",
          title: "A buyer added you as their agent",
          message: `${buyerName} linked you as their agent on Xucasa.`,
          propertyId: null,
          linkUrl: "/agent/dashboard",
          read: false,
          archived: false,
        });

        return { data: null };
      }
    );

    res.json({
      success: true,
      agent: {
        firstName: agentUser.firstName ?? null,
        lastName: agentUser.lastName ?? null,
        brokerageName: agentUser.brokerageName ?? null,
      },
    });
  } catch (err) {
    req.log?.error({ event: "link_agent_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ── GET /api/buyer/my-agent ──────────────────────────────────────────────────
// Authenticated. Returns the buyer's assigned agent public profile or null.
// If assigned to David, returns David's info (buyer sees David as their agent
// until they replace him).

router.get("/api/buyer/my-agent", isAuthenticated, async (req: any, res): Promise<void> => {
  try {
    const buyerUserId = req.user.claims.sub;
    const buyer = await storage.getUser(buyerUserId);

    if (!buyer?.assignedAgentUserId) {
      res.json({ agent: null });
      return;
    }

    const agent = await storage.getUser(buyer.assignedAgentUserId);
    if (!agent) {
      res.json({ agent: null });
      return;
    }

    res.json({ agent: safeAgentFields(agent) });
  } catch (err) {
    req.log?.error({ event: "my_agent_error", error: (err as Error).message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
