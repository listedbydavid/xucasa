type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  event: string;
  userId?: string | null;
  role?: string | null;
  propertyId?: number | null;
  conversationId?: number | null;
  buyerInterestId?: number | null;
  requestId?: string | null;
  outcome?: "success" | "failure";
  error?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, ctx: LogContext): string {
  const entry: Record<string, unknown> = {
    level,
    event: ctx.event,
    timestamp: new Date().toISOString(),
  };

  if (ctx.userId) entry.userId = ctx.userId;
  if (ctx.role) entry.role = ctx.role;
  if (ctx.propertyId != null) entry.propertyId = ctx.propertyId;
  if (ctx.conversationId != null) entry.conversationId = ctx.conversationId;
  if (ctx.buyerInterestId != null) entry.buyerInterestId = ctx.buyerInterestId;
  if (ctx.requestId) entry.requestId = ctx.requestId;
  if (ctx.outcome) entry.outcome = ctx.outcome;
  if (ctx.error) entry.error = ctx.error;
  if (ctx.route) entry.route = ctx.route;
  if (ctx.method) entry.method = ctx.method;
  if (ctx.statusCode != null) entry.statusCode = ctx.statusCode;

  const knownKeys = new Set([
    "event", "userId", "role", "propertyId", "conversationId",
    "buyerInterestId", "requestId", "outcome", "error", "route",
    "method", "statusCode",
  ]);
  for (const [k, v] of Object.entries(ctx)) {
    if (!knownKeys.has(k) && v !== undefined && v !== null) {
      entry[k] = v;
    }
  }

  return JSON.stringify(entry);
}

export const logger = {
  info(ctx: LogContext) {
    console.log(formatLog("info", ctx));
  },
  warn(ctx: LogContext) {
    console.warn(formatLog("warn", ctx));
  },
  error(ctx: LogContext) {
    console.error(formatLog("error", ctx));
  },
  debug(ctx: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("debug", ctx));
    }
  },
};

export function extractLogContext(req: any): Partial<LogContext> {
  return {
    requestId: req?.requestId || req?.headers?.["x-request-id"] || null,
    userId: req?.user?.claims?.sub || null,
    route: req?.originalUrl || req?.path || null,
    method: req?.method || null,
  };
}
