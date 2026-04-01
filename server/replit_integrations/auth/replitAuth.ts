import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { authStorage } from "./storage";
import { resolveUserDestination } from "@shared/routing";
import {
  registerRateLimit,
  loginRateLimit,
  onboardingRateLimit,
  registerSchema,
  loginSchema,
  isBlockedEmail,
  logAuthAttempt,
  checkProgressiveBlock,
  recordFailedAttempt,
  clearFailedAttempts,
} from "../../authMiddleware";
import { audit, executeWithAudit } from "../../auditLog";
import { storage } from "../../storage";
import { sendPasswordResetEmail } from "../../emailService";
import { z } from "zod";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(profile: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}) {
  return await authStorage.upsertUser({
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileImageUrl: profile.profileImageUrl,
  });
}

function getCallbackUrl(req: any): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google OAuth disabled");
  } else {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: "/api/auth/google/callback",
          scope: ["openid", "email", "profile"],
          proxy: true,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || "";
            const firstName = profile.name?.givenName || "";
            const lastName = profile.name?.familyName || "";
            const profileImageUrl = profile.photos?.[0]?.value || "";

            if (process.env.NODE_ENV === "production" && isBlockedEmail(email)) {
              console.log(`[Auth:Audit] action=google_oauth result=blocked_email email=${email} timestamp=${new Date().toISOString()}`);
              return done(new Error("This email domain is not allowed for registration"));
            }

            const existingUser = await authStorage.getUserByEmail(email);
            if (existingUser && (existingUser.status === "disabled" || existingUser.status === "suspended" || existingUser.status === "banned")) {
              console.log(`[Auth:Audit] action=google_oauth result=account_disabled email=${email} timestamp=${new Date().toISOString()}`);
              return done(new Error("This account has been disabled"));
            }

            const user = await upsertUser({
              id: profile.id,
              email,
              firstName,
              lastName,
              profileImageUrl,
            });

            const sessionUser = {
              claims: {
                sub: user.id,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                profile_image_url: user.profileImageUrl,
              },
            };

            audit({ event: "auth_login_success", outcome: "success", userId: user.id, metadata: { provider: "google", email } });
            done(null, sessionUser);
          } catch (err) {
            audit({ event: "auth_login_failure", outcome: "failure", error: (err as Error).message, metadata: { provider: "google" } });
            done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (_req, res) => {
    res.redirect("/api/auth/google");
  });

  app.get("/api/auth/google", (req, res, next) => {
    const callbackURL = getCallbackUrl(req);
    console.log(`[Auth] Initiating Google OAuth — callbackURL: ${callbackURL}`);
    passport.authenticate("google", {
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      callbackURL,
    } as any)(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      const callbackURL = getCallbackUrl(req);
      console.log(`[Auth] Google OAuth callback — callbackURL: ${callbackURL}`);
      passport.authenticate("google", { callbackURL } as any, (err: any, user: any, info: any) => {
        if (err) {
          console.error("[Auth] Google OAuth error:", err.message || err);
          return res.redirect("/?auth=failed");
        }
        if (!user) {
          console.error("[Auth] Google OAuth failed — no user returned. Info:", info);
          return res.redirect("/?auth=failed");
        }
        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            console.error("[Auth] Session login error:", loginErr.message || loginErr);
            return res.redirect("/?auth=failed");
          }
          console.log("[Auth] Google OAuth success for:", (user as any)?.claims?.email);
          try {
            const dbUser = await authStorage.getUser((user as any)?.claims?.sub);
            return res.redirect(resolveUserDestination(dbUser));
          } catch {
            return res.redirect("/dashboard");
          }
        });
      })(req, res, next);
    }
  );

  app.post("/api/auth/register", registerRateLimit, async (req, res) => {
    try {
      if (checkProgressiveBlock(req, res)) return;
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        logAuthAttempt("register", "validation_failed", req, req.body?.email);
        const errors = parsed.error.flatten();
        return res.status(400).json({ message: "Validation failed", errors: errors.fieldErrors });
      }
      const { email, password, firstName, lastName } = parsed.data;

      if (process.env.NODE_ENV === "production" && isBlockedEmail(email)) {
        logAuthAttempt("register", "blocked_email", req, email);
        return res.status(400).json({ message: "This email domain is not allowed for registration" });
      }

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        logAuthAttempt("register", "duplicate_email", req, email);
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await authStorage.upsertUser({
        email,
        firstName,
        lastName,
        passwordHash,
        accountSource: "real",
      });
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
      };
      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[Auth] Session login error after register:", err);
          logAuthAttempt("register", "session_error", req, email);
          audit({ req, event: "auth_register_success", outcome: "failure", error: "session_error", metadata: { email } });
          return res.status(500).json({ message: "Registration succeeded but login failed", requestId: (req as any).requestId });
        }
        logAuthAttempt("register", "success", req, email);
        audit({ req, event: "auth_register_success", outcome: "success", userId: user.id, metadata: { email } });
        return res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, onboardingCompleted: user.onboardingCompleted, currentMode: user.currentMode, primaryIntent: user.primaryIntent } });
      });
    } catch (err: any) {
      console.error("[Auth] Registration error:", err);
      logAuthAttempt("register", "error", req, req.body?.email);
      audit({ req, event: "auth_register_success", outcome: "failure", error: (err as Error).message, metadata: { email: req.body?.email } });
      return res.status(500).json({ message: "Registration failed", requestId: (req as any).requestId });
    }
  });

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      if (checkProgressiveBlock(req, res)) return;
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        logAuthAttempt("login", "validation_failed", req, req.body?.email);
        recordFailedAttempt(req);
        const errors = parsed.error.flatten();
        return res.status(400).json({ message: "Validation failed", errors: errors.fieldErrors });
      }
      const { email, password, rememberMe } = parsed.data;

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        logAuthAttempt("login", "invalid_credentials", req, email);
        recordFailedAttempt(req);
        audit({ req, event: "auth_login_failure", outcome: "failure", error: "invalid_credentials", metadata: { email } });
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.status === "disabled" || user.status === "suspended" || user.status === "banned") {
        logAuthAttempt("login", "account_disabled", req, email);
        recordFailedAttempt(req);
        audit({ req, event: "auth_login_failure", outcome: "failure", userId: user.id, error: "account_disabled", metadata: { email } });
        return res.status(403).json({ message: "This account has been disabled. Please contact support." });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        logAuthAttempt("login", "invalid_password", req, email);
        recordFailedAttempt(req);
        audit({ req, event: "auth_login_failure", outcome: "failure", userId: user.id, error: "invalid_password", metadata: { email } });
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
      };
      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[Auth] Session login error:", err);
          logAuthAttempt("login", "session_error", req, email);
          audit({ req, event: "auth_login_failure", outcome: "failure", error: "session_error", metadata: { email } });
          return res.status(500).json({ message: "Login failed", requestId: (req as any).requestId });
        }
        logAuthAttempt("login", "success", req, email);
        clearFailedAttempts(req);
        audit({ req, event: "auth_login_success", outcome: "success", userId: user.id, metadata: { email } });
        return res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, onboardingCompleted: user.onboardingCompleted, currentMode: user.currentMode, primaryIntent: user.primaryIntent } });
      });
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      logAuthAttempt("login", "error", req, req.body?.email);
      audit({ req, event: "auth_login_failure", outcome: "failure", error: (err as Error).message, metadata: { email: req.body?.email } });
      return res.status(500).json({ message: "Login failed", requestId: (req as any).requestId });
    }
  });

  const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[0-9]/, "Password must contain a digit"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

  function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  app.post("/api/auth/forgot-password", onboardingRateLimit, async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    const { email } = parsed.data;
    const genericResponse = { message: "If an account with that email exists, we've sent reset instructions." };

    try {
      await executeWithAudit(
        { req, event: "forgot_password_requested", metadata: { email } },
        async () => {
          const user = await authStorage.getUserByEmail(email);

          if (!user || !user.passwordHash) {
            return { data: null };
          }

          if (user.status === "disabled" || user.status === "suspended" || user.status === "banned") {
            return { data: null };
          }

          await storage.invalidatePasswordResetTokensForUser(user.id);

          const rawToken = randomBytes(32).toString("hex");
          const tokenHash = hashToken(rawToken);
          const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

          await storage.createPasswordResetToken({
            userId: user.id,
            tokenHash,
            expiresAt,
            usedAt: null,
          });

          const recipientName = user.firstName || undefined;
          const emailResult = await sendPasswordResetEmail(user.email, rawToken, recipientName);

          if (emailResult.sent) {
            await audit({ req, event: "forgot_password_email_sent", outcome: "success", userId: user.id, metadata: { email } });
          } else {
            await audit({ req, event: "forgot_password_email_sent", outcome: "failure", userId: user.id, error: emailResult.reason || "unknown", metadata: { email } });
          }

          return { data: null };
        }
      );

      return res.json(genericResponse);
    } catch (err) {
      return res.json(genericResponse);
    }
  });

  app.post("/api/auth/reset-password", onboardingRateLimit, async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten();
      return res.status(400).json({ message: "Validation failed", errors: errors.fieldErrors });
    }

    const { token, password } = parsed.data;
    const tokenHash = hashToken(token);

    try {
      await executeWithAudit(
        { req, event: "password_reset_completed" },
        async () => {
          const claimed = await storage.claimPasswordResetToken(tokenHash);

          if (!claimed) {
            const existing = await storage.getPasswordResetTokenByHash(tokenHash);
            if (!existing) {
              await audit({ req, event: "password_reset_token_invalid", outcome: "failure", error: "token_not_found" });
              throw new Error("INVALID_TOKEN:This reset link is invalid. Please request a new one.");
            }
            if (existing.usedAt) {
              await audit({ req, event: "password_reset_token_invalid", outcome: "failure", userId: existing.userId, error: "token_already_used" });
              throw new Error("USED_TOKEN:This reset link has already been used. Please request a new one.");
            }
            await audit({ req, event: "password_reset_token_expired", outcome: "failure", userId: existing.userId, error: "token_expired" });
            throw new Error("EXPIRED_TOKEN:This reset link has expired. Please request a new one.");
          }

          const newPasswordHash = await bcrypt.hash(password, 10);
          await storage.updateUserPasswordHash(claimed.userId, newPasswordHash);
          await storage.invalidatePasswordResetTokensForUser(claimed.userId);

          return { data: null, auditOverrides: { resourceType: "user", resourceId: claimed.userId } };
        }
      );

      return res.json({ message: "Your password has been reset successfully. Please sign in with your new password." });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.startsWith("INVALID_TOKEN:") || msg.startsWith("USED_TOKEN:")) {
        return res.status(400).json({ message: msg.split(":").slice(1).join(":") });
      }
      if (msg.startsWith("EXPIRED_TOKEN:")) {
        return res.status(410).json({ message: msg.split(":").slice(1).join(":") });
      }
      await audit({ req, event: "password_reset_failed", outcome: "failure", error: msg });
      return res.status(500).json({ message: "Password reset failed. Please try again.", requestId: (req as any).requestId });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !(req.user as any)?.claims?.sub) {
    audit({ req, event: "authorization_denied", outcome: "failure", metadata: { reason: "unauthenticated", route: req.originalUrl } });
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
