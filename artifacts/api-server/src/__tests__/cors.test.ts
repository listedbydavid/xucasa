import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import cors from "cors";
import express from "express";
import { createCorsOptions } from "../cors";

async function withCorsServer(
  callback: (origin: string) => Promise<void>,
): Promise<void> {
  const app = express();
  const expoOrigin = "https://preview.expo.example.replit.dev";
  app.use(cors(createCorsOptions({ REPLIT_EXPO_DEV_DOMAIN: "preview.expo.example.replit.dev" })));
  app.get("/api/listings", (_req, res) => res.json({ ok: true }));

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

function preflight(origin: string) {
  return {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "content-type",
    },
  };
}

test("allows credentialed requests from the configured Expo origin", async () => {
  const expoOrigin = "https://preview.expo.example.replit.dev";

  await withCorsServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/listings`, preflight(expoOrigin));

    assert.equal(response.headers.get("access-control-allow-origin"), expoOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  });
});

test("does not grant credentialed CORS access to an arbitrary Replit subdomain", async () => {
  await withCorsServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/listings`,
      preflight("https://untrusted.example.replit.dev"),
    );

    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(response.headers.get("access-control-allow-credentials"), null);
  });
});