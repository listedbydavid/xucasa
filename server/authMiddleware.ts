import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { z } from "zod";

export const BLOCKED_EMAIL_PATTERNS = [
  /@test\.com$/i,
  /@example\.com$/i,
  /@example\.org$/i,
  /@example\.net$/i,
  /@mailinator\.com$/i,
  /@tempmail\.com$/i,
  /@throwaway\.email$/i,
  /^e2e[_.-]/i,
  /^test[_.-]/i,
  /^dummy[_.-]/i,
  /^fake[_.-]/i,
  /@.*\.test$/i,
];

export function isBlockedEmail(email: string): boolean {
  return BLOCKED_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

function getProgressiveBlockMs(failCount: number): number {
  if (failCount >= 20) return 60 * 60 * 1000;
  if (failCount >= 10) return 30 * 60 * 1000;
  if (failCount >= 5) return 15 * 60 * 1000;
  return 0;
}

function rateLimitLogger(type: string, req: Request) {
  const ip = req.ip || "unknown";
  const email = req.body?.email || "unknown";
  console.log(
    `[Auth:RateLimit] ${type} rate limit hit | IP: ${ip} | email: ${email} | timestamp: ${new Date().toISOString()}`
  );
}

function checkProgressiveBlock(req: Request, res: Response): boolean {
  const ip = req.ip || "unknown";
  const record = failedAttempts.get(ip);
  if (record && record.blockedUntil > Date.now()) {
    const remainingMs = record.blockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    res.status(429).json({
      message: `Too many failed attempts. Please try again in ${remainingMin} minute${remainingMin > 1 ? "s" : ""}.`,
    });
    return true;
  }
  return false;
}

export function recordFailedAttempt(req: Request) {
  const ip = req.ip || "unknown";
  const record = failedAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  record.count += 1;
  const blockMs = getProgressiveBlockMs(record.count);
  if (blockMs > 0) {
    record.blockedUntil = Date.now() + blockMs;
    console.log(
      `[Auth:Progressive] IP ${ip} blocked for ${blockMs / 60000}min after ${record.count} failures`
    );
  }
  failedAttempts.set(ip, record);
}

export function clearFailedAttempts(req: Request) {
  const ip = req.ip || "unknown";
  failedAttempts.delete(ip);
}

setInterval(() => {
  const now = Date.now();
  const staleCutoff = now - 2 * 60 * 60 * 1000;
  for (const [ip, record] of failedAttempts) {
    if (record.blockedUntil > 0 && record.blockedUntil < staleCutoff) {
      failedAttempts.delete(ip);
    } else if (record.blockedUntil === 0 && record.count > 0) {
      failedAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

export const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || "unknown",
  handler: (req: Request, res: Response) => {
    rateLimitLogger("register", req);
    recordFailedAttempt(req);
    res.status(429).json({
      message:
        "Too many registration attempts. Please try again in 15 minutes.",
    });
  },
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || "unknown",
  handler: (req: Request, res: Response) => {
    rateLimitLogger("login", req);
    recordFailedAttempt(req);
    res.status(429).json({
      message: "Too many login attempts. Please try again in 15 minutes.",
    });
  },
});

export const onboardingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || "unknown",
  handler: (req: Request, res: Response) => {
    rateLimitLogger("onboarding", req);
    res.status(429).json({
      message: "Too many requests. Please try again in 15 minutes.",
    });
  },
});

export { checkProgressiveBlock };

const forgotPasswordIpTracker = new Map<string, number[]>();
const forgotPasswordEmailTracker = new Map<string, number[]>();

const FORGOT_PW_IP_LIMIT = 5;
const FORGOT_PW_IP_WINDOW_MS = 10 * 60 * 1000;
const FORGOT_PW_EMAIL_LIMIT = 3;
const FORGOT_PW_EMAIL_WINDOW_MS = 60 * 60 * 1000;

function pruneTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter(t => t > cutoff);
}

export function checkForgotPasswordRateLimit(req: Request, email: string): { limited: boolean; reason?: string } {
  const ip = req.ip || "unknown";
  const now = Date.now();

  let ipTimestamps = pruneTimestamps(forgotPasswordIpTracker.get(ip) || [], FORGOT_PW_IP_WINDOW_MS);
  if (ipTimestamps.length >= FORGOT_PW_IP_LIMIT) {
    return { limited: true, reason: `ip_limit_exceeded:${ip}` };
  }

  const normalizedEmail = email.trim().toLowerCase();
  let emailTimestamps = pruneTimestamps(forgotPasswordEmailTracker.get(normalizedEmail) || [], FORGOT_PW_EMAIL_WINDOW_MS);
  if (emailTimestamps.length >= FORGOT_PW_EMAIL_LIMIT) {
    return { limited: true, reason: `email_limit_exceeded:${normalizedEmail}` };
  }

  ipTimestamps.push(now);
  emailTimestamps.push(now);
  forgotPasswordIpTracker.set(ip, ipTimestamps);
  forgotPasswordEmailTracker.set(normalizedEmail, emailTimestamps);

  return { limited: false };
}

setInterval(() => {
  const ipCutoff = Date.now() - FORGOT_PW_IP_WINDOW_MS;
  for (const [ip, timestamps] of forgotPasswordIpTracker) {
    const pruned = timestamps.filter(t => t > ipCutoff);
    if (pruned.length === 0) forgotPasswordIpTracker.delete(ip);
    else forgotPasswordIpTracker.set(ip, pruned);
  }
  const emailCutoff = Date.now() - FORGOT_PW_EMAIL_WINDOW_MS;
  for (const [email, timestamps] of forgotPasswordEmailTracker) {
    const pruned = timestamps.filter(t => t > emailCutoff);
    if (pruned.length === 0) forgotPasswordEmailTracker.delete(email);
    else forgotPasswordEmailTracker.set(email, pruned);
  }
}, 15 * 60 * 1000);

const trimmedEmail = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().email("Invalid email format"));

export const registerSchema = z
  .object({
    email: trimmedEmail,
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    firstName: z.string().max(100, "First name must be 100 characters or less").optional().default(""),
    lastName: z.string().max(100, "Last name must be 100 characters or less").optional().default(""),
  })
  .strict();

export const loginSchema = z
  .object({
    email: trimmedEmail,
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional(),
  })
  .strict();

export function logAuthAttempt(
  action: string,
  result: string,
  req: Request,
  email?: string
) {
  const ip = req.ip || "unknown";
  console.log(
    `[Auth:Audit] action=${action} result=${result} ip=${ip} email=${email || "unknown"} timestamp=${new Date().toISOString()}`
  );
}
