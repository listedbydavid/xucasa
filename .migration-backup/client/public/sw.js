const CACHE_VERSION = 4;
const STATIC_CACHE = `xucasa-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `xucasa-dynamic-v${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  OFFLINE_URL,
];

const STATIC_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".woff2", ".woff", ".ttf", ".ico", ".webp"];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isAuthRequest(url) {
  return url.pathname.startsWith("/login") || url.pathname.startsWith("/logout") || url.pathname.startsWith("/__replauthuser");
}

const SENSITIVE_API_PATTERNS = [
  "/api/saved-properties",
  "/api/saved-searches",
  "/api/profile",
  "/api/dashboard",
  "/api/agent-clients",
  "/api/admin",
  "/api/beacon",
  "/api/notifications",
  "/api/search-history",
  "/api/favorite-lists",
  "/api/user",
  "/api/swipe",
  "/api/property-offers",
];

function isSensitiveApi(url) {
  return SENSITIVE_API_PATTERNS.some((p) => url.pathname.startsWith(p));
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (isAuthRequest(url)) return;

  if (isApiRequest(url)) {
    if (isSensitiveApi(url)) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(networkFirstWithTimeout(request, DYNAMIC_CACHE, 5000));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      networkFirstWithTimeout(request, STATIC_CACHE, 3000).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    throw err;
  }
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  try {
    const response = await promiseWithTimeout(fetch(request), timeoutMs);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

function promiseWithTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
