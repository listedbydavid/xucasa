import { logger, extractLogContext } from "./logger";
import { storage } from "./storage";
import { randomUUID } from "crypto";
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
      errorMessage: params.error || null,
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

export interface AuditContext {
  req: any;
  event: string;
  userId?: string | null;
  role?: string | null;
  propertyId?: number | null;
  conversationId?: number | null;
  buyerInterestId?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditedResult<T> {
  data: T;
  auditOverrides?: Partial<Pick<AuditContext, "propertyId" | "conversationId" | "buyerInterestId" | "resourceType" | "resourceId" | "metadata">>;
}

export async function executeWithAudit<T>(
  context: AuditContext,
  handler: () => Promise<AuditedResult<T>>
): Promise<T> {
  if (!context.req.requestId) {
    context.req.requestId = context.req.headers?.["x-request-id"] || randomUUID();
  }

  const userId = context.userId || context.req.user?.claims?.sub || null;

  try {
    const result = await handler();

    const merged = { ...context, ...result.auditOverrides };

    await audit({
      req: context.req,
      event: context.event,
      outcome: "success",
      userId,
      role: context.role,
      propertyId: merged.propertyId,
      conversationId: merged.conversationId,
      buyerInterestId: merged.buyerInterestId,
      resourceType: merged.resourceType,
      resourceId: merged.resourceId,
      metadata: merged.metadata,
    });

    return result.data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await audit({
      req: context.req,
      event: context.event,
      outcome: "failure",
      userId,
      role: context.role,
      propertyId: context.propertyId,
      conversationId: context.conversationId,
      buyerInterestId: context.buyerInterestId,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      error: errorMessage,
      metadata: context.metadata,
    });

    throw err;
  }
}
