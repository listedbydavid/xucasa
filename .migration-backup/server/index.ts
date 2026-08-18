import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { requestIdMiddleware } from "./requestId";
import { logger } from "./logger";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(requestIdMiddleware);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { setupAuth } = await import("./replit_integrations/auth/replitAuth");
  await setupAuth(app);
  await registerRoutes(httpServer, app);

  try {
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq, and, ne, or, isNull } = await import("drizzle-orm");
    await db.update(users)
      .set({ onboardingCompleted: true })
      .where(and(eq(users.role, "admin"), or(isNull(users.onboardingCompleted), ne(users.onboardingCompleted, true))));
    log("Admin onboarding backfill complete");
  } catch (e) {
    log("Admin onboarding backfill skipped: " + (e as Error).message);
  }

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
