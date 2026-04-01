import { logger, extractLogContext } from "./logger";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import type { InsertAuditEvent } from "@shared/schema";

const AUDIT_RETRY_COUNT = 2;
const AUDIT_RETRY_DELAY_MS = 200;

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

function validateAuditEvent(event: InsertAuditEvent): string[] {
  const errors: string[] = [];
  if (!event.eventType || typeof event.eventType !== "string" || event.eventType.trim() === "") {
    errors.push("eventType is required and must be a non-empty string");
  }
  if (!event.outcome || !["success", "failure"].includes(event.outcome)) {
    errors.push("outcome must be 'success' or 'failure'");
  }
  if (event.outcome === "failure" && event.errorMessage && typeof event.errorMessage !== "string") {
    errors.push("errorMessage must be a string when provided");
  }
  if (event.metadata && typeof event.metadata !== "object") {
    errors.push("metadata must be an object when provided");
  }
  return errors;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function persistAuditWithRetry(auditEvent: InsertAuditEvent, requestId: string | null): Promise<void> {
  const validationErrors = validateAuditEvent(auditEvent);
  if (validationErrors.length > 0) {
    logger.error({
      event: "audit_validation_failed",
      errors: validationErrors,
      auditEventType: auditEvent.eventType,
      requestId,
    });
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AUDIT_RETRY_COUNT; attempt++) {
    try {
      await storage.createAuditEvent(auditEvent);
      return;
    } catch (err) {
      lastError = err as Error;

      if (attempt < AUDIT_RETRY_COUNT) {
        logger.warn({
          event: "audit_retry_attempt",
          attempt: attempt + 1,
          maxRetries: AUDIT_RETRY_COUNT,
          auditEventType: auditEvent.eventType,
          error: lastError.message,
          requestId,
        });
        await sleep(AUDIT_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  logger.error({
    event: "audit_final_failure",
    auditEventType: auditEvent.eventType,
    outcome: auditEvent.outcome,
    actorUserId: auditEvent.actorUserId,
    error: lastError?.message || "unknown",
    retriesExhausted: AUDIT_RETRY_COUNT,
    requestId,
  });
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

  await persistAuditWithRetry(auditEvent, requestId);
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
