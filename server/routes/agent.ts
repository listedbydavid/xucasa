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

import { checkFairHousing } from "../lib/notificationHelpers";

router.post("/api/agent/verify", isAuthenticated, async (req: any, res) => {
  const { licenseNumber, licenseState, association, brokerageName } = req.body || {};
  try {
    const userId = req.user.claims.sub;

    if (!licenseNumber || typeof licenseNumber !== "string" || licenseNumber.trim().length < 2) {
      return res.status(400).json({ message: "License number is required" });
    }
    if (!/^[A-Za-z0-9\-. ]{2,30}$/.test(licenseNumber.trim())) {
      return res.status(400).json({ message: "License number contains invalid characters" });
    }

    const result = await runAgentVerificationFlow(req, userId, {
      licenseNumber: licenseNumber.trim(),
      licenseState: licenseState || null,
      association: association || null,
      brokerageName: brokerageName || null,
    });
    return res.json(result);
  } catch (err: any) {
    console.error("Agent verify error:", err);
    await audit({
      req,
      event: "agent_verify_failed",
      outcome: "failure",
      userId: req.user?.claims?.sub,
      errorMessage: err.message,
      metadata: {
        licenseNumber: typeof licenseNumber === "string" ? licenseNumber.trim() : undefined,
        licenseState: licenseState || undefined,
      },
    });
    res.status(500).json({ message: "Failed to verify agent license" });
  }
});

router.post("/api/agent/submit-info", isAuthenticated, async (req: any, res) => {
  try {
    const { authStorage } = await import("../replit_integrations/auth/storage");
    const userId = req.user.claims.sub;
    const { licenseNumber, licenseState, association, brokerageName } = req.body;

    if (!licenseNumber || typeof licenseNumber !== "string" || licenseNumber.trim().length < 2) {
      return res.status(400).json({ message: "License number is required" });
    }

    const updated = await authStorage.updateAgentInfo(userId, {
      licenseNumber: licenseNumber.trim(),
      licenseState: licenseState || null,
      association: association || null,
      brokerageName: brokerageName || null,
    });
    await audit({ req, event: "agent_info_submitted", outcome: "success", userId, metadata: { licenseNumber: licenseNumber.trim() } });
    res.json(updated);
  } catch (err: any) {
    await audit({ req, event: "agent_info_submitted", outcome: "failure", userId: req.user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: "Failed to save agent information" });
  }
});

router.get("/api/agent-invite", isAuthenticated, async (req: any, res) => {
  try {
    const link = await storage.getClientAgentLink(req.user.sub);
    res.json(link ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/agent-invite", isAuthenticated, async (req: any, res) => {
  try {
    const { agentEmail } = req.body;
    if (!agentEmail) return res.status(400).json({ message: "agentEmail required" });
    const link = await storage.upsertClientAgentLink(req.user.sub, agentEmail.trim().toLowerCase());
    await audit({ req, event: "agent_invite_created", outcome: "success", userId: req.user.sub, metadata: { agentEmail: agentEmail.trim().toLowerCase() } });
    res.json(link);
  } catch (err: any) {
    await audit({ req, event: "agent_invite_created", outcome: "failure", userId: req.user?.sub, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/agent-invite", isAuthenticated, async (req: any, res) => {
  try {
    await storage.deleteClientAgentLink(req.user.sub);
    await audit({ req, event: "agent_invite_deleted", outcome: "success", userId: req.user.sub });
    res.json({ message: "Removed" });
  } catch (err: any) {
    await audit({ req, event: "agent_invite_deleted", outcome: "failure", userId: req.user?.sub, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent-clients", isAuthenticated, async (req: any, res) => {
  try {
    const { email } = req.user as any;
    const clients = await storage.getAgentClients(email);
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent-clients/:clientId/favorites", isAuthenticated, async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const agentEmail = req.user.email;
    const clients = await storage.getAgentClients(agentEmail);
    if (!clients.find(c => c.clientId === clientId)) {
      return res.status(403).json({ message: "Not authorized to view this client" });
    }
    const saved = await storage.getSavedProperties(clientId);
    res.json(saved.map(s => ({ ...s, property: stripConfidentialFields(s.property) })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent-clients/:clientId/searches", isAuthenticated, async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const agentEmail = req.user.email;
    const clients = await storage.getAgentClients(agentEmail);
    if (!clients.find(c => c.clientId === clientId)) {
      return res.status(403).json({ message: "Not authorized to view this client" });
    }
    const searches = await storage.getSavedSearches(clientId);
    res.json(searches);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent/contacts", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const tagId = req.query.tagId ? Number(req.query.tagId) : undefined;
    const contacts = await storage.getAgentContacts(agentId, tagId);
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/agent/contacts", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const { firstName, lastName, email, phone, mailingAddress, notes, source, tagIds } = req.body;
    if (!firstName) return res.status(400).json({ message: "First name is required" });
    const contact = await storage.createAgentContact({
      agentId, firstName, lastName, email, phone, mailingAddress, notes,
      source: source || "manual",
    });
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const ownedTags = await storage.getContactTags(agentId);
      const ownedIds = new Set(ownedTags.map(t => t.id));
      for (const tagId of tagIds) {
        if (ownedIds.has(tagId)) {
          await storage.assignTagToContact(contact.id, tagId);
        }
      }
    }
    const full = await storage.getAgentContact(contact.id, agentId);
    res.status(201).json(full);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/api/agent/contacts/:id", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const id = Number(req.params.id);
    const { firstName, lastName, email, phone, mailingAddress, notes } = req.body;
    const updated = await storage.updateAgentContact(id, agentId, {
      firstName, lastName, email, phone, mailingAddress, notes,
    });
    if (!updated) return res.status(404).json({ message: "Contact not found" });
    const full = await storage.getAgentContact(id, agentId);
    res.json(full);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/api/agent/contacts/:id", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    await storage.deleteAgentContact(Number(req.params.id), agentId);
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/agent/contacts/import-csv", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const { contacts, tagIds } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: "No contacts provided" });
    }
    if (contacts.length > 1000) {
      return res.status(400).json({ message: "Maximum 1000 contacts per import" });
    }

    const toInsert = contacts.map((c: any) => ({
      agentId,
      firstName: c.firstName || "Unknown",
      lastName: c.lastName || null,
      email: c.email || null,
      phone: c.phone || null,
      mailingAddress: c.mailingAddress || null,
      notes: c.notes || null,
      source: "csv_import" as const,
    }));

    const created = await storage.createAgentContactsBulk(toInsert);

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const ownedTags = await storage.getContactTags(agentId);
      const ownedIds = new Set(ownedTags.map(t => t.id));
      const validTagIds = tagIds.filter((id: number) => ownedIds.has(id));
      const createdIds = created.map(c => c.id);
      for (const tagId of validTagIds) {
        await storage.assignTagToContacts(createdIds, tagId);
      }
    }

    res.status(201).json({ imported: created.length });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/agent/contacts/import-phone", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const { contacts, tagIds } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: "No contacts provided" });
    }

    const toInsert = contacts.map((c: any) => ({
      agentId,
      firstName: c.firstName || c.name?.split(" ")[0] || "Unknown",
      lastName: c.lastName || c.name?.split(" ").slice(1).join(" ") || null,
      email: c.email || null,
      phone: c.phone || null,
      source: "phone_import" as const,
    }));

    const created = await storage.createAgentContactsBulk(toInsert);

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      const ownedTags = await storage.getContactTags(agentId);
      const ownedIds = new Set(ownedTags.map(t => t.id));
      const validTagIds = tagIds.filter((id: number) => ownedIds.has(id));
      for (const tagId of validTagIds) {
        await storage.assignTagToContacts(created.map(c => c.id), tagId);
      }
    }

    res.status(201).json({ imported: created.length });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/api/agent/tags", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const tags = await storage.getContactTags(agentId);
    res.json(tags);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/agent/tags", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ message: "Tag name is required" });
    const tag = await storage.createContactTag({ agentId, name, color: color || "blue" });
    res.status(201).json(tag);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/api/agent/tags/:id", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const { name, color } = req.body;
    const updated = await storage.updateContactTag(Number(req.params.id), agentId, { name, color });
    if (!updated) return res.status(404).json({ message: "Tag not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/api/agent/tags/:id", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    await storage.deleteContactTag(Number(req.params.id), agentId);
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/agent/contacts/:id/tags", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const contactId = Number(req.params.id);
    const { tagId } = req.body;
    if (!tagId) return res.status(400).json({ message: "tagId is required" });
    const contact = await storage.getAgentContact(contactId, agentId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const tags = await storage.getContactTags(agentId);
    if (!tags.find(t => t.id === tagId)) return res.status(403).json({ message: "Tag not owned by you" });
    const assignment = await storage.assignTagToContact(contactId, tagId);
    res.status(201).json(assignment);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/api/agent/contacts/:id/tags/:tagId", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const contactId = Number(req.params.id);
    const tagId = Number(req.params.tagId);
    const contact = await storage.getAgentContact(contactId, agentId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    await storage.removeTagFromContact(contactId, tagId);
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/api/agent/buyer-clients", isAuthenticated, async (req, res) => {
  try {
    const profiles = await storage.getAgentBuyerProfiles(req.user!.claims.sub);
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/agent/buyer-clients", isAuthenticated, async (req, res) => {
  try {
    const { insertBuyerProfileSchema } = await import("@shared/schema");
    const parsed = insertBuyerProfileSchema.omit({ userId: true, agentId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    const textToCheck = [
      ...(parsed.data.mustHaves || []),
      ...(parsed.data.niceToHaves || []),
      ...(parsed.data.dealBreakers || []),
      parsed.data.bio || "",
    ].join(" ");
    const violation = checkFairHousing(textToCheck);
    if (violation) return res.status(400).json({ message: violation });
    const agentId = req.user!.claims.sub;
    const data = { ...parsed.data, userId: agentId, agentId };
    const profile = await storage.createBuyerProfile(data);
    res.status(201).json(profile);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/api/agent/buyer-clients/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const profile = await storage.getBuyerProfile(id);
    if (!profile || profile.agentId !== req.user!.claims.sub) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { insertBuyerProfileSchema } = await import("@shared/schema");
    const parsed = insertBuyerProfileSchema.omit({ userId: true, agentId: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    const updated = await storage.updateBuyerProfile(id, profile.userId, parsed.data);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/agent/buyer-clients/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const profile = await storage.getBuyerProfile(id);
    if (!profile || profile.agentId !== req.user!.claims.sub) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteBuyerProfile(id, profile.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
