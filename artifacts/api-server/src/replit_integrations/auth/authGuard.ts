import type { RequestHandler } from "express";
import { audit } from "../../auditLog";

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !(req.user as any)?.claims?.sub) {
    audit({
      req,
      event: "authorization_denied",
      outcome: "failure",
      metadata: { reason: "unauthenticated", route: req.originalUrl },
    });
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};