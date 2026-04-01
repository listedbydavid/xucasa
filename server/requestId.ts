import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  const existing = req.headers["x-request-id"];
  req.requestId = typeof existing === "string" && existing.length > 0 ? existing : randomUUID();
  next();
}
