import { Router } from "express";
import { z } from "zod";
import { DAVID_USER_ID, storage } from "../storage";
import { authStorage } from "../replit_integrations/auth/storage";
import { isAuthenticated } from "../replit_integrations/auth/authGuard";
import { stripConfidentialFields } from "../lib/mlsHelpers";
import { audit } from "../auditLog";

const router = Router();

function actorId(req: any): string {
  return req.user.claims.sub;
}

async function requireVerifiedAgent(req: any, res: any): Promise<string | null> {
  const agentUserId = actorId(req);
  const agent = await authStorage.getUser(agentUserId);
  if (!agent || agent.role !== "agent" || !agent.agentVerified) {
    res.status(403).json({ message: "Verified agent access required" });
    return null;
  }
  return agentUserId;
}

async function currentAgentLink(clientId: string) {
  const client = await storage.getUser(clientId);
  if (!client?.assignedAgentUserId) return null;
  const agent = await storage.getUser(client.assignedAgentUserId);
  if (!agent?.email) return null;
  return {
    clientId,
    agentEmail: agent.email,
    agentId: agent.id,
    status: "active",
    createdAt: client.updatedAt ?? client.createdAt ?? null,
  };
}

router.get("/api/agent-invite", isAuthenticated, async (req: any, res) => {
  try {
    res.json(await currentAgentLink(actorId(req)));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/agent-invite", isAuthenticated, async (req: any, res) => {
  const parsed = z.object({ agentEmail: z.string().email().max(200) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "agentEmail required",
      errors: parsed.error.flatten(),
    });
  }

  const clientId = actorId(req);
  const agentEmail = parsed.data.agentEmail.trim().toLowerCase();

  try {
    const agent = await authStorage.getUserByEmail(agentEmail);
    if (!agent || agent.role !== "agent" || !agent.agentVerified) {
      return res.status(404).json({ message: "Verified agent not found" });
    }

    const assigned = await storage.assignAgent(clientId, agent.id);
    if (!assigned) {
      return res.status(409).json({
        message: "You are already represented by another agent",
      });
    }

    await audit({
      req,
      event: "agent_invite_created",
      outcome: "success",
      userId: clientId,
      metadata: { agentId: agent.id },
    });
    return res.json(await currentAgentLink(clientId));
  } catch (err: any) {
    await audit({
      req,
      event: "agent_invite_created",
      outcome: "failure",
      userId: clientId,
      errorMessage: err.message,
    });
    return res.status(500).json({ message: err.message });
  }
});

router.delete("/api/agent-invite", isAuthenticated, async (req: any, res) => {
  const clientId = actorId(req);
  try {
    const client = await storage.getUser(clientId);
    if (!client) return res.status(404).json({ message: "User not found" });
    if (client.assignedAgentUserId && client.assignedAgentUserId !== DAVID_USER_ID) {
      return res.status(409).json({
        message: "A represented buyer cannot remove their agent from this flow",
      });
    }

    const david = await storage.getUser(DAVID_USER_ID);
    if (!david?.email) {
      return res.status(503).json({ message: "Platform agent is unavailable" });
    }

    const assigned = await storage.assignAgent(clientId, DAVID_USER_ID);
    if (!assigned) {
      return res.status(409).json({ message: "Agent relationship changed; refresh and try again" });
    }

    await audit({
      req,
      event: "agent_invite_deleted",
      outcome: "success",
      userId: clientId,
      metadata: { assignedAgentUserId: DAVID_USER_ID },
    });
    return res.json({ message: "Platform agent restored" });
  } catch (err: any) {
    await audit({
      req,
      event: "agent_invite_deleted",
      outcome: "failure",
      userId: clientId,
      errorMessage: err.message,
    });
    return res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent-clients", isAuthenticated, async (req: any, res) => {
  try {
    const agentUserId = await requireVerifiedAgent(req, res);
    if (!agentUserId) return;
    res.json(await storage.getAgentClients(agentUserId));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent-clients/:clientId/favorites", isAuthenticated, async (req: any, res) => {
  try {
    const agentUserId = await requireVerifiedAgent(req, res);
    if (!agentUserId) return;
    const client = await storage.getUser(req.params.clientId);
    if (client?.assignedAgentUserId !== agentUserId) {
      return res.status(403).json({ message: "Not authorized to view this client" });
    }
    const saved = await storage.getSavedProperties(req.params.clientId);
    return res.json(saved.map(item => ({
      ...item,
      property: stripConfidentialFields(item.property),
    })));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/api/agent-clients/:clientId/searches", isAuthenticated, async (req: any, res) => {
  try {
    const agentUserId = await requireVerifiedAgent(req, res);
    if (!agentUserId) return;
    const client = await storage.getUser(req.params.clientId);
    if (client?.assignedAgentUserId !== agentUserId) {
      return res.status(403).json({ message: "Not authorized to view this client" });
    }
    return res.json(await storage.getSavedSearches(req.params.clientId));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;