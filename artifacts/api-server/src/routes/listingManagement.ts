import { Router } from "express";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { properties } from "@workspace/db";
import { db } from "../db";
import { storage } from "../storage";
import { authStorage } from "../replit_integrations/auth/storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { stripConfidentialFields } from "../lib/mlsHelpers";

const router = Router();

async function requireVerifiedOwner(req: any, res: any, propertyId: number) {
  const userId = req.user?.claims?.sub;
  const [agent, property] = await Promise.all([
    userId ? authStorage.getUser(userId) : null,
    storage.getProperty(propertyId),
  ]);
  if (!agent || agent.role !== "agent" || agent.agentVerified !== true) {
    res.status(403).json({ message: "Verified agent access required" });
    return null;
  }
  if (!property) {
    res.status(404).json({ message: "Property not found" });
    return null;
  }
  if (property.agentId !== userId || property.source !== "manual") {
    res.status(403).json({ message: "You can only manage photos for your own agent-created listings" });
    return null;
  }
  return { agent, property };
}

router.get("/api/agent/listings", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const agent = await authStorage.getUser(userId);
  if (!agent || agent.role !== "agent" || agent.agentVerified !== true) {
    return res.status(403).json({ message: "Verified agent access required" });
  }

  const created = (await storage.getPropertiesByAgent(userId)).filter(property => property.source !== "idx");
  const identityFilters = [
    agent.email ? ilike(properties.listingAgentEmail, agent.email) : undefined,
    agent.agentMlsId ? eq(properties.listingAgentMlsId, agent.agentMlsId) : undefined,
  ].filter(Boolean) as any[];
  const attributed = identityFilters.length
    ? await db.select().from(properties).where(and(
        eq(properties.source, "idx"),
        sql`LOWER(COALESCE(${properties.status}, '')) <> 'draft'`,
        or(...identityFilters),
      ))
    : [];

  res.json({
    created,
    attributed: attributed.map(stripConfidentialFields),
  });
});

router.put("/api/properties/:id/photos/reorder", isAuthenticated, async (req: any, res) => {
  const propertyId = Number(req.params.id);
  if (!Number.isInteger(propertyId)) return res.status(400).json({ message: "Invalid property ID" });
  const context = await requireVerifiedOwner(req, res, propertyId);
  if (!context) return;
  const next = Array.isArray(req.body?.photos) ? req.body.photos.filter((url: unknown) => typeof url === "string") : null;
  const current = context.property.photos || [];
  if (!next || next.length > 20 || next.length !== current.length || [...next].sort().join("\n") !== [...current].sort().join("\n")) {
    return res.status(400).json({ message: "Photo order must include each current photo exactly once" });
  }
  const updated = await storage.updateProperty(propertyId, { photos: next, imageUrl: next[0] || null } as any);
  return res.json({ photos: updated.photos, imageUrl: updated.imageUrl });
});

export default router;
