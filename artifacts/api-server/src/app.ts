import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { requestIdMiddleware } from "./requestId";
import { logger } from "./logger";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export async function createApp() {
  const app: Express = express();
  const httpServer = createServer(app);

  app.set("trust proxy", 1);

  app.use(requestIdMiddleware);

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        log(logLine);
      }
    });

    next();
  });

  // Health check (before auth)
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Setup auth
  const { setupAuth } = await import("./replit_integrations/auth/replitAuth");
  await setupAuth(app);

  // Register all legacy routes
  const { registerRoutes } = await import("./routes/index");
  await registerRoutes(httpServer, app);

  // Admin onboarding backfill
  try {
    const { db } = await import("./db");
    const { users } = await import("@workspace/db");
    const { eq, and, ne, or, isNull } = await import("drizzle-orm");
    await db.update(users)
      .set({ onboardingCompleted: true })
      .where(and(eq(users.role, "admin"), or(isNull(users.onboardingCompleted), ne(users.onboardingCompleted, true))));
    log("Admin onboarding backfill complete");
  } catch (e) {
    log("Admin onboarding backfill skipped: " + (e as Error).message);
  }

  // Error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const rawMessage = err.message || "Internal Server Error";
    const reqId = (req as any).requestId || null;
    const isProd = process.env.NODE_ENV === "production";
    const isClientError = status >= 400 && status < 500;
    const clientMessage = isProd && !isClientError ? "Internal Server Error" : rawMessage;

    logger.error({
      event: "unexpected_server_error",
      requestId: reqId,
      route: req.originalUrl,
      method: req.method,
      statusCode: status,
      error: err.stack || err.message || String(err),
      outcome: "failure",
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message: clientMessage, requestId: reqId });
  });

  return { app, httpServer };
}
