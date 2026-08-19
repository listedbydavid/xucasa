import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import session from "express-session";
import {
  getNativeSessionToken,
  mobileBearerSession,
  sessionCookieName,
} from "../replit_integrations/auth/nativeSession.ts";

declare module "express-session" {
  interface SessionData {
    testUserId?: string;
  }
}

const TEST_SECRET = "native-session-test-secret";
process.env.SESSION_SECRET = TEST_SECRET;

async function withSessionServer(
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(mobileBearerSession);
  app.use(session({
    secret: TEST_SECRET,
    resave: false,
    saveUninitialized: false,
  }));

  app.post("/mint", (req, res, next) => {
    req.session.testUserId = "native-test-user";
    req.session.save((error) => {
      if (error) return next(error);
      return res.json({ sessionToken: getNativeSessionToken(req) });
    });
  });

  app.get("/protected", (req, res) => {
    if (req.session.testUserId !== "native-test-user") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return res.json({ ok: true });
  });

  app.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(sessionCookieName);
      return res.status(204).end();
    });
  });

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function bearer(sessionToken: string) {
  return { Authorization: `Bearer ${sessionToken}` };
}

test("issues a token only to native clients and restores their session", async () => {
  await withSessionServer(async (baseUrl) => {
    const browserResponse = await fetch(`${baseUrl}/mint`, { method: "POST" });
    assert.equal(browserResponse.status, 200);
    assert.equal((await browserResponse.json()).sessionToken, undefined);

    const nativeResponse = await fetch(`${baseUrl}/mint`, {
      method: "POST",
      headers: { "X-Xucasa-Client": "native" },
    });
    assert.equal(nativeResponse.status, 200);
    const { sessionToken } = await nativeResponse.json();
    assert.equal(typeof sessionToken, "string");

    const protectedResponse = await fetch(`${baseUrl}/protected`, {
      headers: bearer(sessionToken),
    });
    assert.equal(protectedResponse.status, 200);
  });
});

test("rejects a tampered bearer and invalidates a destroyed session", async () => {
  await withSessionServer(async (baseUrl) => {
    const nativeResponse = await fetch(`${baseUrl}/mint`, {
      method: "POST",
      headers: { "X-Xucasa-Client": "native" },
    });
    const { sessionToken } = await nativeResponse.json();

    const validResponse = await fetch(`${baseUrl}/protected`, {
      headers: bearer(sessionToken),
    });
    assert.equal(validResponse.status, 200);

    const tamperedToken = `${sessionToken.slice(0, -1)}${sessionToken.endsWith("A") ? "B" : "A"}`;
    const tamperedResponse = await fetch(`${baseUrl}/protected`, {
      headers: bearer(tamperedToken),
    });
    assert.equal(tamperedResponse.status, 401);

    const logoutResponse = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: bearer(sessionToken),
    });
    assert.equal(logoutResponse.status, 204);

    const afterLogout = await fetch(`${baseUrl}/protected`, {
      headers: bearer(sessionToken),
    });
    assert.equal(afterLogout.status, 401);
  });
});