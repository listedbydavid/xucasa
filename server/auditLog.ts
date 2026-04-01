import { logger, extractLogContext } from "./logger";
import { storage } from "./storage";
import type { InsertAuditEvent } from "@shared/schema";

interface AuditParams {
  req?: any;
  event: string;
  outcome: "success" | "failure";
  userId?: string | null;
  role?: string | null;
  propertyId?: number | null;
  conversationId?: number | null;
  buyerInterestId?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function audit(params: AuditParams): Promise<void> {
  const reqCtx = params.req ? extractLogContext(params.req) : {};
  const requestId = reqCtx.requestId || null;

  const logCtx = {
    event: params.event,
    outcome: params.outcome as "success" | "failure",
    userId: params.userId || reqCtx.userId || null,
    role: params.role || null,
    propertyId: params.propertyId || null,
    conversationId: params.conversationId || null,
    buyerInterestId: params.buyerInterestId || null,
    requestId,
    route: reqCtx.route || null,
    method: reqCtx.method || null,
    error: params.error || null,
  };

  if (params.outcome === "failure") {
    logger.error(logCtx);
  } else {
    logger.info(logCtx);
  }

  try {
    const auditEvent: InsertAuditEvent = {
      eventType: params.event,
      actorUserId: params.userId || reqCtx.userId || null,
      actorRole: params.role || null,
      propertyId: params.propertyId || null,
      conversationId: params.conversationId || null,
      buyerInterestId: params.buyerInterestId || null,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      requestId,
      outcome: params.outcome,
      metadata: params.metadata || null,
    };
    await storage.createAuditEvent(auditEvent);
  } catch (err) {
    logger.error({
      event: "audit_persist_failed",
      error: (err as Error).message,
      requestId,
    });
  }
}
