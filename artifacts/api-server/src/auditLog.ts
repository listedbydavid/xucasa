import { logger, extractLogContext } from "./logger";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import type { InsertAuditEvent } from "@workspace/db";

const AUDIT_RETRY_COUNT = 2;
const AUDIT_RETRY_DELAY_MS = 200;

const CRITICAL_EVENTS = new Set([
  "password_reset_completed",
  "forgot_password_requested",
  "conversation_created",
  "coordination_thread_created",
  "showing_request_created",
  "showing_status_changed",
  "reverse_offer_created",
  "buyer_offer_response",
]);

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
  errorMessage?: string | null;
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

async function persistAuditWithRetry(auditEvent: InsertAuditEvent, requestId: string | null): Promise<boolean> {
  const validationErrors = validateAuditEvent(auditEvent);
  if (validationErrors.length > 0) {
    logger.error({
      event: "audit_validation_failed",
      errors: validationErrors,
      auditEventType: auditEvent.eventType,
      requestId,
    });
    return false;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AUDIT_RETRY_COUNT; attempt++) {
    try {
      await storage.createAuditEvent(auditEvent);
      return true;
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
    level: "critical",
    auditEventType: auditEvent.eventType,
    outcome: auditEvent.outcome as ("success" | "failure" | undefined),
    actorUserId: auditEvent.actorUserId,
    error: lastError?.message || "unknown",
    retriesExhausted: AUDIT_RETRY_COUNT,
    requestId,
    isCriticalEvent: CRITICAL_EVENTS.has(auditEvent.eventType || ""),
  });

  return false;
}

export async function audit(params: AuditParams): Promise<boolean> {
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

  return await persistAuditWithRetry(auditEvent, requestId);
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
  critical?: boolean;
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

  const isCritical = context.critical !== undefined ? context.critical : CRITICAL_EVENTS.has(context.event);
  const userId = context.userId || context.req.user?.claims?.sub || null;

  try {
    const result = await handler();

    const merged = { ...context, ...result.auditOverrides };

    const persisted = await audit({
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

    if (!persisted && isCritical) {
      logger.error({
        event: "critical_audit_failure_post_action",
        level: "critical",
        actionEvent: context.event,
        userId,
        requestId: context.req.requestId,
        message: "Critical action completed but audit persistence failed. Action flagged as unverified.",
      });
    }

    return result.data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    const persisted = await audit({
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

    if (!persisted && isCritical) {
      logger.error({
        event: "critical_audit_failure_on_error",
        level: "critical",
        actionEvent: context.event,
        userId,
        requestId: context.req.requestId,
        error: errorMessage,
        message: "Critical action failed AND audit persistence failed.",
      });
    }

    throw err;
  }
}

let auditContextActive = false;

export function isAuditContextActive(): boolean {
  return auditContextActive;
}

export function setAuditContextActive(active: boolean): void {
  auditContextActive = active;
}

export async function executeWithAuditGuard<T>(
  context: AuditContext,
  handler: () => Promise<AuditedResult<T>>
): Promise<T> {
  const prev = auditContextActive;
  auditContextActive = true;
  try {
    return await executeWithAudit(context, handler);
  } finally {
    auditContextActive = prev;
  }
}

export function requireAuditContext(operationName: string): void {
  if (!auditContextActive) {
    const err = new Error(`AUDIT_GUARD: Mutation "${operationName}" attempted outside audit context. All mutations must go through executeWithAudit.`);
    logger.error({
      event: "audit_guard_violation",
      level: "critical",
      operation: operationName,
      stack: err.stack,
    });
    throw err;
  }
}
