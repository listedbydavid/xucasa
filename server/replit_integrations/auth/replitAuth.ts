import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";

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

            done(null, sessionUser);
          } catch (err) {
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
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error("[Auth] Session login error:", loginErr.message || loginErr);
            return res.redirect("/?auth=failed");
          }
          console.log("[Auth] Google OAuth success for:", (user as any)?.claims?.email);
          return res.redirect("/");
        });
      })(req, res, next);
    }
  );

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await authStorage.upsertUser({
        email,
        firstName: firstName || "",
        lastName: lastName || "",
        passwordHash,
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
          return res.status(500).json({ message: "Registration succeeded but login failed" });
        }
        console.log("[Auth] Email registration success for:", email);
        return res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (err: any) {
      console.error("[Auth] Registration error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
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
          return res.status(500).json({ message: "Login failed" });
        }
        console.log("[Auth] Email login success for:", email, rememberMe ? "(remember me)" : "");
        return res.json({ ok: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      return res.status(500).json({ message: "Login failed" });
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
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
