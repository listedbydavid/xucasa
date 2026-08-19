import { createHmac } from "node:crypto";
import type { Request, RequestHandler } from "express";

const SESSION_COOKIE_NAME = "connect.sid";
const NATIVE_CLIENT_HEADER = "native";

export function createMobileSessionToken(sessionId: string, secret = process.env.SESSION_SECRET): string {
  if (!secret) throw new Error("SESSION_SECRET is required");
  const signature = createHmac("sha256", secret)
    .update(sessionId)
    .digest("base64")
    .replace(/=+$/, "");
  return `s:${sessionId}.${signature}`;
}

export function getNativeSessionToken(req: Request): string | undefined {
  if (req.get("x-xucasa-client") !== NATIVE_CLIENT_HEADER) return undefined;
  return createMobileSessionToken(req.sessionID);
}

export const mobileBearerSession: RequestHandler = (req, _res, next) => {
  const authorization = req.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token.length <= 512 && /^s:[A-Za-z0-9._+/-]+$/.test(token)) {
      req.headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
    }
  }
  next();
};

export const sessionCookieName = SESSION_COOKIE_NAME;