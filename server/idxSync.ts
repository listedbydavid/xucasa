/**
 * IDX Broker Sync Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Pulls live MLS listings from the IDX Broker REST API and upserts them into
 * the local properties table.
 *
 * HOW TO ACTIVATE:
 *   1. Sign up at https://idxbroker.com and get approved by your MLS
 *   2. Grab your API key from: Account → API → Access Key
 *   3. Add it as the environment variable:  IDX_BROKER_API_KEY=your_key_here
 *   4. The sync will run automatically every 4 hours, or hit POST /api/idx/sync
 *
 * IDX Broker API docs: https://middleware.idxbroker.com/api/
 *
 * RESO Web API note:
 *   If your MLS provides RESO Web API credentials instead (OAuth2 + JSON:API),
 *   set IDX_RESO_URL and IDX_RESO_TOKEN env vars — the resoSync() helper below
 *   handles that path automatically.
 */

import { db } from "./db";
import { properties, idxSyncLog } from "@shared/schema";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";

const IDX_BASE = "https://middleware.idxbroker.com/api";
const IDX_KEY = process.env.IDX_BROKER_API_KEY || "";
const RESO_URL = process.env.IDX_RESO_URL || "";
const RESO_TOKEN = process.env.IDX_RESO_TOKEN || "";
const RESO_CLIENT_ID = process.env.IDX_RESO_CLIENT_ID || "";
const RESO_CLIENT_SECRET = process.env.IDX_RESO_CLIENT_SECRET || "";

interface ResoProvider {
  name: string;
  tokenUrl: string | null;
  apiBase: string;
  scope?: string;
  directToken?: boolean;
}

const RESO_PROVIDERS: ResoProvider[] = [
  {
    name: "RealtyFeed (Realtyna)",
    tokenUrl: null,
    apiBase: "https://api.realtyfeed.com/reso/odata",
    directToken: true,
  },
  {
    name: "Trestle (CoreLogic)",
    tokenUrl: "https://api-trestle.corelogic.com/trestle/oidc/connect/token",
    apiBase: "https://api-trestle.corelogic.com/trestle/odata",
    scope: "api",
  },
  {
    name: "Bridge Interactive",
    tokenUrl: "https://api.bridgedataoutput.com/api/v2/OData/test/oauth/token",
    apiBase: "https://api.bridgedataoutput.com/api/v2/OData/test",
  },
  {
    name: "Spark (FBS)",
    tokenUrl: "https://sparkplatform.com/v1/oauth2/token",
    apiBase: "https://replication.sparkapi.com/Reso/OData",
  },
  {
    name: "CRMLS",
    tokenUrl: "https://crmls-api.corelogic.com/trestle/oidc/connect/token",
    apiBase: "https://crmls-api.corelogic.com/trestle/odata",
    scope: "api",
  },
];

let cachedResoToken: { token: string; expiresAt: number } | null = null;
let discoveredProvider: ResoProvider | null = null;

export function idxConfigured(): boolean {
  return !!(IDX_KEY || (RESO_URL && RESO_TOKEN) || (RESO_CLIENT_ID && RESO_CLIENT_SECRET));
}

function resoOAuthConfigured(): boolean {
  return !!(RESO_CLIENT_ID && RESO_CLIENT_SECRET);
}

async function tryDirectTokenAccess(provider: ResoProvider, token: string): Promise<boolean> {
  try {
    const testUrl = `${provider.apiBase}/Property?$top=1&$select=ListingKey`;
    const res = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.ok) {
      const body = await res.json();
      if (body.value !== undefined) return true;
    }
    console.log(`[IDX Sync] ${provider.name} direct access → HTTP ${res.status}`);
    return false;
  } catch (err: any) {
    console.log(`[IDX Sync] ${provider.name} direct access → Error: ${err.message}`);
    return false;
  }
}

async function tryTokenEndpoint(provider: ResoProvider): Promise<{ token: string; expiresIn: number } | null> {
  if (provider.directToken) {
    const candidates = [RESO_CLIENT_SECRET, RESO_CLIENT_ID];
    for (const candidate of candidates) {
      if (!candidate) continue;
      console.log(`[IDX Sync] ${provider.name} → Testing direct Bearer token...`);
      const ok = await tryDirectTokenAccess(provider, candidate);
      if (ok) {
        return { token: candidate, expiresIn: 86400 * 365 };
      }
    }
    return null;
  }

  if (!provider.tokenUrl) return null;

  const params: Record<string, string> = {
    grant_type: "client_credentials",
    client_id: RESO_CLIENT_ID,
    client_secret: RESO_CLIENT_SECRET,
  };
  if (provider.scope) params.scope = provider.scope;

  try {
    const res = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.log(`[IDX Sync] ${provider.name} → HTTP ${res.status}: ${errText.slice(0, 150)}`);
      return null;
    }
    const data = await res.json();
    if (!data.access_token) {
      console.log(`[IDX Sync] ${provider.name} → No access_token in response`);
      return null;
    }
    return { token: data.access_token, expiresIn: data.expires_in || 3600 };
  } catch (err: any) {
    console.log(`[IDX Sync] ${provider.name} → Network error: ${err.message}`);
    return null;
  }
}

async function getResoOAuthToken(): Promise<string> {
  if (cachedResoToken && cachedResoToken.expiresAt > Date.now() + 60000) {
    return cachedResoToken.token;
  }

  if (discoveredProvider) {
    console.log(`[IDX Sync] Refreshing token from ${discoveredProvider.name}...`);
    const result = await tryTokenEndpoint(discoveredProvider);
    if (result) {
      cachedResoToken = { token: result.token, expiresAt: Date.now() + result.expiresIn * 1000 };
      console.log(`[IDX Sync] Token refreshed (expires in ${result.expiresIn}s)`);
      return result.token;
    }
    discoveredProvider = null;
  }

  console.log("[IDX Sync] Discovering RESO provider — trying all known OAuth2 endpoints...");
  for (const provider of RESO_PROVIDERS) {
    const result = await tryTokenEndpoint(provider);
    if (result) {
      discoveredProvider = provider;
      cachedResoToken = { token: result.token, expiresAt: Date.now() + result.expiresIn * 1000 };
      console.log(`[IDX Sync] ✓ Authenticated with ${provider.name} (expires in ${result.expiresIn}s)`);
      return result.token;
    }
  }

  throw new Error("RESO OAuth2 failed — none of the known providers accepted the credentials. Tried: " +
    RESO_PROVIDERS.map(p => p.name).join(", "));
}

function getResoApiBase(): string {
  if (RESO_URL) return RESO_URL;
  if (discoveredProvider) return discoveredProvider.apiBase;
  return RESO_PROVIDERS[0].apiBase;
}

// ── Status helpers ────────────────────────────────────────────────────────────

export async function getLastSyncLog() {
  const [last] = await db
    .select()
    .from(idxSyncLog)
    .orderBy(sql`${idxSyncLog.startedAt} DESC`)
    .limit(1);
  return last || null;
}

export async function getSyncLogs(limit = 10) {
  return db
    .select()
    .from(idxSyncLog)
    .orderBy(sql`${idxSyncLog.startedAt} DESC`)
    .limit(limit);
}

// ── IDX Broker API helpers ────────────────────────────────────────────────────

async function idxFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${IDX_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      accesskey: IDX_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      outputtype: "json",
    },
    redirect: "manual",
  });

  if (res.status === 302 || res.status === 301) {
    const location = res.headers.get("location") || "";
    if (location.includes("404")) {
      throw new Error(`IDX API ${endpoint} → redirected to 404. Your API key may not be fully activated yet. Contact IDX Broker support or your MLS to confirm API access is enabled.`);
    }
    throw new Error(`IDX API ${endpoint} → HTTP ${res.status} redirect to ${location}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IDX API ${endpoint} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch ALL active listings from IDX Broker, paginated.
 * Tries multiple endpoint patterns: /clients/featured, /clients/listings,
 * /clients/soldpending, and /mls/searchresults as fallbacks.
 * IDX Broker returns max 500 per page.
 */
async function fetchAllIdxListings(): Promise<any[]> {
  const endpoints = [
    { path: "/clients/featured", label: "featured" },
    { path: "/clients/listings", label: "listings" },
    { path: "/clients/soldpending", label: "soldpending" },
    { path: "/mls/searchresults/0", label: "mls-search" },
  ];

  let workingEndpoint: string | null = null;

  for (const ep of endpoints) {
    try {
      console.log(`[IDX Sync] Trying endpoint: ${ep.path}...`);
      const test = await idxFetch(ep.path, { limit: "1" });
      workingEndpoint = ep.path;
      console.log(`[IDX Sync] Endpoint ${ep.path} (${ep.label}) is accessible`);
      break;
    } catch (e: any) {
      console.log(`[IDX Sync] Endpoint ${ep.path} not available: ${e.message.slice(0, 120)}`);
    }
  }

  if (!workingEndpoint) {
    throw new Error(
      "No IDX Broker API endpoints are accessible. Your API key may not be fully activated yet. " +
      "Please contact IDX Broker support or your MLS (SD MLS) to confirm:\n" +
      "  1. API access is enabled for your account\n" +
      "  2. Your API key has 'client' level access\n" +
      "  3. Your MLS data feed is provisioned"
    );
  }

  const all: any[] = [];
  let start = 0;
  const pageSize = 500;

  while (true) {
    const page = await idxFetch(workingEndpoint, {
      start: String(start),
      limit: String(pageSize),
    });

    const raw = Array.isArray(page) ? page : Object.values(page);
    const listings = raw.filter((item: any) => typeof item === "object" && item !== null && !Array.isArray(item));
    if (!listings.length) break;

    all.push(...listings);
    if (listings.length < pageSize) break;
    start += pageSize;

    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

// ── RESO Web API helpers ──────────────────────────────────────────────────────

async function fetchAllResoListings(): Promise<any[]> {
  let token: string;
  let baseUrl: string;

  if (resoOAuthConfigured()) {
    token = await getResoOAuthToken();
    baseUrl = getResoApiBase();
  } else {
    token = RESO_TOKEN;
    baseUrl = RESO_URL;
  }

  const all: any[] = [];
  let nextUrl: string | null = `${baseUrl}/Property?$filter=StandardStatus eq 'Active'&$top=200&$select=ListingKey,ListingId,ListPrice,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,LivingArea,LotSizeSquareFeet,StreetNumber,StreetName,UnitNumber,City,StateOrProvince,PostalCode,Latitude,Longitude,PublicRemarks,Media,ListDate,AssociationFee,MlsStatus,PropertyType,YearBuilt`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`RESO API → HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const body = await res.json();
    const records = body.value || [];
    all.push(...records);
    console.log(`[IDX Sync] RESO fetched ${all.length} listings so far...`);
    nextUrl = body["@odata.nextLink"] || null;
    if (nextUrl) await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

// ── Normalise raw listing → our property shape ────────────────────────────────

function normaliseIdxBroker(raw: any) {
  const streetParts = (raw.address || "").split(" ");
  const streetNumber = /^\d+$/.test(streetParts[0]) ? streetParts[0] : "";
  const streetName = streetNumber ? streetParts.slice(1).join(" ") : raw.address || "";

  const beds = parseInt(raw.bedrooms || raw.beds || "0") || 0;
  const bathsFull = parseInt(raw.bathsFull || "0");
  const bathsHalf = parseInt(raw.bathsHalf || "0");
  const baths = String(bathsFull + bathsHalf * 0.5);
  const price = parseInt((raw.listPrice || raw.listingPrice || "0").toString().replace(/[^0-9]/g, "")) || 0;
  const sqft = parseInt((raw.sqFt || raw.sqft || "0").toString().replace(/[^0-9]/g, "")) || 0;
  const city = raw.cityName || raw.city || "";
  const state = raw.state || raw.stateOrProvince || "";

  // First photo from IDX Broker's photo object
  let imageUrl: string | null = null;
  if (raw.image) {
    const imgs = typeof raw.image === "object" ? Object.values(raw.image) : [];
    imageUrl = (imgs[0] as string) || null;
  }

  return {
    idxId: String(raw.listingID || raw.idxPropType || ""),
    mlsNumber: raw.mlsNumber || raw.mlsNum || null,
    title: `${raw.address || ""}, ${city}`.trim(),
    description: raw.remarksConcat || raw.remarks || `MLS listing at ${raw.address}, ${city}, ${state}.`,
    price,
    addressStreetNumber: streetNumber || null,
    addressStreetName: streetName || null,
    addressUnitNumber: raw.unitNumber || null,
    addressCity: city || null,
    addressState: state || null,
    addressZip: raw.zipcode || raw.zip || null,
    location: `${city}, ${state}`,
    beds,
    baths,
    sqft,
    lotSize: parseInt((raw.lotSqFt || "0").toString().replace(/[^0-9]/g, "")) || null,
    hoaFee: raw.hoa ? parseInt(raw.hoa) : null,
    lat: raw.latitude ? String(raw.latitude) : null,
    lng: raw.longitude ? String(raw.longitude) : null,
    imageUrl,
    status: "active" as const,
    source: "idx" as const,
    isOffMarket: false,
    listDate: raw.listDate ? new Date(raw.listDate) : null,
  };
}

function normaliseReso(raw: any) {
  let imageUrl: string | null = null;
  let photos: string[] | null = null;

  if (raw.Media && Array.isArray(raw.Media)) {
    const photoMedia = raw.Media
      .filter((m: any) => m.MediaCategory === "Photo" || m.MediaType === "image/jpeg")
      .sort((a: any, b: any) => (a.Order || 0) - (b.Order || 0));
    if (photoMedia.length > 0) {
      imageUrl = photoMedia[0].MediaURL || null;
      photos = photoMedia.map((m: any) => m.MediaURL).filter(Boolean);
    }
  }

  const bathsFull = parseInt(raw.BathroomsFull || raw.BathroomsTotalInteger || "0") || 0;
  const bathsHalf = parseInt(raw.BathroomsHalf || "0") || 0;
  const baths = String(bathsFull + bathsHalf * 0.5);

  return {
    idxId: String(raw.ListingKey || raw.ListingId || ""),
    mlsNumber: raw.ListingId || null,
    title: `${raw.StreetNumber || ""} ${raw.StreetName || ""}, ${raw.City || ""}`.trim(),
    description: raw.PublicRemarks || `MLS listing at ${raw.StreetNumber} ${raw.StreetName}, ${raw.City}.`,
    price: parseInt(raw.ListPrice || "0") || 0,
    addressStreetNumber: raw.StreetNumber ? String(raw.StreetNumber) : null,
    addressStreetName: raw.StreetName || null,
    addressUnitNumber: raw.UnitNumber || null,
    addressCity: raw.City || null,
    addressState: raw.StateOrProvince || null,
    addressZip: raw.PostalCode || null,
    location: `${raw.City || ""}, ${raw.StateOrProvince || ""}`,
    beds: parseInt(raw.BedroomsTotal || "0") || 0,
    baths,
    sqft: parseInt(raw.LivingArea || "0") || 0,
    lotSize: parseInt(raw.LotSizeSquareFeet || "0") || null,
    hoaFee: raw.AssociationFee ? parseInt(raw.AssociationFee) : null,
    lat: raw.Latitude ? String(raw.Latitude) : null,
    lng: raw.Longitude ? String(raw.Longitude) : null,
    imageUrl,
    photos,
    status: "active" as const,
    source: "idx" as const,
    isOffMarket: false,
    listDate: raw.ListDate ? new Date(raw.ListDate) : null,
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

let syncInProgress = false;

export async function runIdxSync(): Promise<{ added: number; updated: number; removed: number; total: number }> {
  if (syncInProgress) throw new Error("Sync already in progress");
  if (!idxConfigured()) throw new Error("IDX not configured — set IDX_BROKER_API_KEY, or IDX_RESO_CLIENT_ID + IDX_RESO_CLIENT_SECRET, or IDX_RESO_URL + IDX_RESO_TOKEN");

  syncInProgress = true;

  // Create log entry
  const [log] = await db.insert(idxSyncLog).values({ status: "running" }).returning();

  try {
    console.log("[IDX Sync] Starting…");

    let rawListings: any[];
    let useReso = false;

    if (resoOAuthConfigured()) {
      console.log("[IDX Sync] Using RESO Web API (OAuth2 client_credentials)");
      rawListings = await fetchAllResoListings();
      useReso = true;
    } else if (RESO_URL && RESO_TOKEN) {
      console.log("[IDX Sync] Using RESO Web API (static Bearer token)");
      rawListings = await fetchAllResoListings();
      useReso = true;
    } else if (IDX_KEY) {
      console.log("[IDX Sync] Using IDX Broker API");
      rawListings = await fetchAllIdxListings();
    } else {
      throw new Error("No IDX/RESO credentials configured");
    }

    console.log(`[IDX Sync] Fetched ${rawListings.length} listings`);

    const normalised = rawListings
      .map(r => useReso ? normaliseReso(r) : normaliseIdxBroker(r))
      .filter(r => r.idxId && r.price > 0);

    // Get current IDX ids in DB
    const existingIdxRows = await db
      .select({ idxId: properties.idxId, id: properties.id })
      .from(properties)
      .where(eq(properties.source, "idx"));

    const existingMap = new Map(existingIdxRows.map(r => [r.idxId!, r.id]));
    const incomingIds = new Set(normalised.map(r => r.idxId));

    let added = 0, updated = 0, removed = 0;

    // Upsert listings in batches
    for (const listing of normalised) {
      const existingId = existingMap.get(listing.idxId);
      const payload = { ...listing, idxUpdatedAt: new Date() };

      if (existingId) {
        await db.update(properties).set(payload).where(eq(properties.id, existingId));
        updated++;
      } else {
        await db.insert(properties).values(payload);
        added++;
      }
    }

    // Mark IDX listings no longer in feed as "removed"
    const toRemove = existingIdxRows
      .filter(r => r.idxId && !incomingIds.has(r.idxId))
      .map(r => r.id);

    if (toRemove.length) {
      await db
        .update(properties)
        .set({ status: "removed" })
        .where(inArray(properties.id, toRemove));
      removed = toRemove.length;
    }

    const total = normalised.length;
    console.log(`[IDX Sync] Done — added: ${added}, updated: ${updated}, removed: ${removed}`);

    await db
      .update(idxSyncLog)
      .set({ status: "success", completedAt: new Date(), added, updated, removed, total })
      .where(eq(idxSyncLog.id, log.id));

    return { added, updated, removed, total };
  } catch (err: any) {
    console.error("[IDX Sync] Error:", err.message);
    await db
      .update(idxSyncLog)
      .set({ status: "error", completedAt: new Date(), error: err.message })
      .where(eq(idxSyncLog.id, log.id));
    throw err;
  } finally {
    syncInProgress = false;
  }
}

export function isSyncInProgress() {
  return syncInProgress;
}

// ── Scheduled auto-sync (every 4 hours) ──────────────────────────────────────

export function startIdxAutoSync() {
  if (!idxConfigured()) {
    console.log("[IDX Sync] Not configured — skipping auto-sync. Set IDX_RESO_CLIENT_ID + IDX_RESO_CLIENT_SECRET (or IDX_BROKER_API_KEY) to activate.");
    return;
  }

  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  console.log("[IDX Sync] Auto-sync scheduled every 4 hours");

  // Run once on startup (after 30s to let server settle)
  setTimeout(async () => {
    try { await runIdxSync(); }
    catch (e: any) { console.error("[IDX Sync] Startup sync failed:", e.message); }
  }, 30_000);

  // Then every 4 hours
  setInterval(async () => {
    try { await runIdxSync(); }
    catch (e: any) { console.error("[IDX Sync] Scheduled sync failed:", e.message); }
  }, FOUR_HOURS);
}
