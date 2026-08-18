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
  const parsedVerify = z.object({
    licenseNumber: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9\-. ]+$/, "License number contains invalid characters"),
    licenseState: z.string().max(10).optional().nullable(),
    association: z.string().max(200).optional().nullable(),
    brokerageName: z.string().max(200).optional().nullable(),
  }).safeParse(req.body);
  if (!parsedVerify.success) {
    const msg = parsedVerify.error.errors[0]?.message || "License number is required";
    return res.status(400).json({ message: msg, errors: parsedVerify.error.flatten() });
  }
  const { licenseNumber, licenseState, association, brokerageName } = parsedVerify.data;
  try {
    const userId = req.user.claims.sub;

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
    const parsedSubmit = z.object({
      licenseNumber: z.string().trim().min(2).max(30),
      licenseState: z.string().max(10).optional().nullable(),
      association: z.string().max(200).optional().nullable(),
      brokerageName: z.string().max(200).optional().nullable(),
    }).safeParse(req.body);
    if (!parsedSubmit.success) return res.status(400).json({ message: "License number is required", errors: parsedSubmit.error.flatten() });
    const { licenseNumber, licenseState, association, brokerageName } = parsedSubmit.data;

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
    const parsedInvite = z.object({ agentEmail: z.string().email().max(200) }).safeParse(req.body);
    if (!parsedInvite.success) return res.status(400).json({ message: "agentEmail required", errors: parsedInvite.error.flatten() });
    const agentEmail = parsedInvite.data.agentEmail;
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
    const parsedContact = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().max(100).optional().nullable(),
      email: z.string().email().max(200).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
      mailingAddress: z.string().max(500).optional().nullable(),
      notes: z.string().max(5000).optional().nullable(),
      source: z.string().max(50).optional(),
      tagIds: z.array(z.number().int().positive()).optional(),
    }).safeParse(req.body);
    if (!parsedContact.success) return res.status(400).json({ message: "First name is required", errors: parsedContact.error.flatten() });
    const { firstName, lastName, email, phone, mailingAddress, notes, source, tagIds } = parsedContact.data;
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
    const parsedContactUpdate = z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().max(100).optional().nullable(),
      email: z.string().email().max(200).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
      mailingAddress: z.string().max(500).optional().nullable(),
      notes: z.string().max(5000).optional().nullable(),
    }).safeParse(req.body);
    if (!parsedContactUpdate.success) return res.status(400).json({ message: "Invalid request", errors: parsedContactUpdate.error.flatten() });
    const { firstName, lastName, email, phone, mailingAddress, notes } = parsedContactUpdate.data;
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
    const parsedImport = z.object({
      contacts: z.array(z.any()).min(1).max(1000),
      tagIds: z.array(z.number().int().positive()).optional(),
    }).safeParse(req.body);
    if (!parsedImport.success) return res.status(400).json({ message: "No contacts provided (max 1000)", errors: parsedImport.error.flatten() });
    const { contacts, tagIds } = parsedImport.data;

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
  const agentId = req.user!.claims.sub;
  const contactSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    company: z.string().optional(),
    notes: z.string().optional(),
  });
  const parsed = z.object({
    contacts: z.array(contactSchema).min(1).max(500),
    skipDuplicates: z.boolean().default(true),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  }

  return executeWithAudit(
    {
      req,
      event: "contacts_imported",
      role: "agent",
      resourceType: "agent_contacts",
    },
    async () => {
      const existing = await storage.getAgentContacts(agentId);
      const existingEmails = new Set(
        existing.map(c => c.email?.toLowerCase()).filter(Boolean) as string[]
      );
      const existingPhones = new Set(
        existing
          .map(c => (c.phone || "").replace(/\D/g, ""))
          .filter(p => p.length >= 10)
      );

      const toInsert: Array<{
        agentId: string;
        firstName: string;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
        source: "phone_import";
      }> = [];
      const duplicates: string[] = [];

      for (const contact of parsed.data.contacts) {
        const emailNorm = contact.email?.toLowerCase();
        const phoneNorm = contact.phone?.replace(/\D/g, "");
        const isDuplicate =
          (emailNorm && existingEmails.has(emailNorm)) ||
          (phoneNorm && phoneNorm.length >= 10 && existingPhones.has(phoneNorm));

        if (isDuplicate && parsed.data.skipDuplicates) {
          duplicates.push(contact.name);
          continue;
        }

        const parts = contact.name.trim().split(/\s+/);
        const firstName = parts[0] || "Unknown";
        const lastName = parts.slice(1).join(" ") || null;
        const noteParts = [contact.notes, contact.company ? `Company: ${contact.company}` : null].filter(Boolean) as string[];

        toInsert.push({
          agentId,
          firstName,
          lastName,
          email: contact.email || null,
          phone: contact.phone || null,
          notes: noteParts.length ? noteParts.join("\n") : null,
          source: "phone_import",
        });

        if (emailNorm) existingEmails.add(emailNorm);
        if (phoneNorm && phoneNorm.length >= 10) existingPhones.add(phoneNorm);
      }

      const created = toInsert.length > 0 ? await storage.createAgentContactsBulk(toInsert) : [];
      const skipped = duplicates.length;
      const imported = created.length;
      const message = `${imported} contact${imported !== 1 ? "s" : ""} imported${skipped > 0 ? `, ${skipped} skipped (already exist)` : ""}.`;

      res.json({ success: true, imported, skipped, duplicates, message });

      return {
        data: undefined,
        auditOverrides: {
          metadata: { imported, skipped, total: parsed.data.contacts.length, source: "phone" },
        },
      };
    }
  ).catch(() => {
    if (!res.headersSent) res.status(500).json({ message: "Internal server error" });
  });
});

router.post("/api/agent/contacts/preview-vcard", isAuthenticated, async (req: any, res) => {
  const parsed = z.object({
    vcard: z.string().min(1).max(5 * 1024 * 1024),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  }
  try {
    const VCard = (await import("vcf")).default;
    const cards = VCard.parse(parsed.data.vcard);
    const contacts = cards.map(card => {
      const nameField = card.get("fn") ?? card.get("n");
      const name = nameField
        ? (Array.isArray(nameField) ? nameField[0].valueOf() : nameField.valueOf())
        : "";
      const emailField = card.get("email");
      const email = emailField
        ? (Array.isArray(emailField) ? emailField[0].valueOf() : emailField.valueOf())
        : undefined;
      const telField = card.get("tel");
      const phone = telField
        ? (Array.isArray(telField) ? telField[0].valueOf() : telField.valueOf())
        : undefined;
      const orgField = card.get("org");
      const company = orgField
        ? (Array.isArray(orgField) ? orgField[0].valueOf() : orgField.valueOf())
        : undefined;
      return {
        name: (name ?? "").replace(/;+/g, " ").trim(),
        email,
        phone,
        company,
      };
    }).filter(c => c.name.length > 0);
    res.json({ contacts, total: contacts.length });
  } catch {
    res.status(400).json({ message: "Could not parse vCard file. Please check the format and try again." });
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
    const parsedTag = z.object({ name: z.string().min(1).max(100), color: z.string().max(50).optional() }).safeParse(req.body);
    if (!parsedTag.success) return res.status(400).json({ message: "Tag name is required", errors: parsedTag.error.flatten() });
    const { name, color } = parsedTag.data;
    const tag = await storage.createContactTag({ agentId, name, color: color || "blue" });
    res.status(201).json(tag);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/api/agent/tags/:id", isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user!.claims.sub;
    const parsedTagPut = z.object({ name: z.string().min(1).max(100).optional(), color: z.string().max(50).optional() }).safeParse(req.body);
    if (!parsedTagPut.success) return res.status(400).json({ message: "Invalid request", errors: parsedTagPut.error.flatten() });
    const { name, color } = parsedTagPut.data;
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
    const parsedAssign = z.object({ tagId: z.number().int().positive() }).safeParse(req.body);
    if (!parsedAssign.success) return res.status(400).json({ message: "tagId is required", errors: parsedAssign.error.flatten() });
    const { tagId } = parsedAssign.data;
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
