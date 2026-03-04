/**
 * IDX / RealtyFeed Sync Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Pulls live MLS listings from RealtyFeed RESO OData API and upserts them
 * into the local properties table.
 *
 * Auth flow (RealtyFeed / Realtyna):
 *   1. POST /v1/auth/token  →  { access_token, expires_in, token_type }
 *   2. GET  /reso/odata/Property  with  Authorization: Bearer <token>
 *
 * Env vars:
 *   IDX_RESO_CLIENT_ID      – RealtyFeed client_id
 *   IDX_RESO_CLIENT_SECRET  – RealtyFeed client_secret
 *   IDX_REALTYFEED_API_KEY  – RealtyFeed API key (optional, for x-api-key header)
 *   IDX_BROKER_API_KEY      – Legacy IDX Broker key (fallback)
 */

import { db } from "./db";
import { properties, idxSyncLog } from "@shared/schema";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";

const IDX_BASE = "https://middleware.idxbroker.com/api";
const IDX_KEY = process.env.IDX_BROKER_API_KEY || "";

const RESO_CLIENT_ID = process.env.IDX_RESO_CLIENT_ID || "";
const RESO_CLIENT_SECRET = process.env.IDX_RESO_CLIENT_SECRET || "";
const RESO_API_KEY = process.env.IDX_REALTYFEED_API_KEY || "";

const REALTYFEED_TOKEN_URL = "https://api.realtyfeed.com/v1/auth/token";
const REALTYFEED_API_BASE = "https://api.realtyfeed.com/reso/odata";

let cachedToken: { token: string; tokenType: string; expiresAt: number } | null = null;

export function idxConfigured(): boolean {
  return !!(IDX_KEY || (RESO_CLIENT_ID && RESO_CLIENT_SECRET));
}

function realtyFeedConfigured(): boolean {
  return !!(RESO_CLIENT_ID && RESO_CLIENT_SECRET);
}

async function fetchRealtyFeedToken(forceNew = false): Promise<{ token: string; tokenType: string; expiresIn: number }> {
  const url = forceNew
    ? `${REALTYFEED_TOKEN_URL}?force_new_token=true`
    : REALTYFEED_TOKEN_URL;

  const form = new URLSearchParams({
    client_id: RESO_CLIENT_ID,
    client_secret: RESO_CLIENT_SECRET,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RealtyFeed auth failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`RealtyFeed auth response missing access_token: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[IDX Sync] RealtyFeed token obtained (expires_in: ${data.expires_in}s${forceNew ? ", forced new" : ""})`);
  return {
    token: data.access_token,
    tokenType: data.token_type || "Bearer",
    expiresIn: parseInt(data.expires_in || "0") || 86400,
  };
}

async function getRealtyFeedToken(): Promise<string> {
  const SKEW = 60;
  if (cachedToken && Date.now() / 1000 < cachedToken.expiresAt - SKEW) {
    return cachedToken.token;
  }

  const result = await fetchRealtyFeedToken();
  cachedToken = {
    token: result.token,
    tokenType: result.tokenType,
    expiresAt: Date.now() / 1000 + result.expiresIn,
  };
  return cachedToken.token;
}

async function forceRefreshToken(): Promise<string> {
  const result = await fetchRealtyFeedToken(true);
  cachedToken = {
    token: result.token,
    tokenType: result.tokenType,
    expiresAt: Date.now() / 1000 + result.expiresIn,
  };
  return cachedToken.token;
}

function buildHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (RESO_API_KEY) {
    headers["x-api-key"] = RESO_API_KEY;
    headers["Origin"] = RESO_API_KEY;
    headers["Referer"] = RESO_API_KEY;
  }
  return headers;
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

// ── IDX Broker API helpers (legacy fallback) ─────────────────────────────────

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
      throw new Error(`IDX API ${endpoint} → redirected to 404. Your API key may not be fully activated yet.`);
    }
    throw new Error(`IDX API ${endpoint} → HTTP ${res.status} redirect to ${location}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IDX API ${endpoint} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

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
      await idxFetch(ep.path, { limit: "1" });
      workingEndpoint = ep.path;
      console.log(`[IDX Sync] Endpoint ${ep.path} (${ep.label}) is accessible`);
      break;
    } catch (e: any) {
      console.log(`[IDX Sync] Endpoint ${ep.path} not available: ${e.message.slice(0, 120)}`);
    }
  }

  if (!workingEndpoint) {
    throw new Error(
      "No IDX Broker API endpoints are accessible. Your API key may not be fully activated yet."
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

// ── RealtyFeed RESO OData fetcher ─────────────────────────────────────────────

const RESO_SELECT_FIELDS = [
  "ListingKey", "ListingId", "ListPrice", "BedroomsTotal",
  "BathroomsTotalInteger", "BathroomsFull", "BathroomsHalf",
  "LivingArea", "LotSizeSquareFeet", "LotSizeAcres",
  "StreetNumber", "StreetName", "UnitNumber",
  "City", "StateOrProvince", "PostalCode",
  "Latitude", "Longitude", "PublicRemarks",
  "ListDate", "AssociationFee", "MlsStatus", "StandardStatus",
  "PropertyType", "PropertySubType", "YearBuilt",
  "ListAgentFullName", "ListAgentFirstName", "ListAgentLastName",
  "ListAgentEmail", "ListAgentDirectPhone", "ListAgentOfficePhone",
  "ListOfficeName",
].join(",");

async function realtyFeedODataFetch(url: string, token: string): Promise<Response> {
  const headers = buildHeaders(token);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });

  if (res.status === 401 || res.status === 403) {
    console.log(`[IDX Sync] Got ${res.status}, forcing token refresh and retrying...`);
    const newToken = await forceRefreshToken();
    const retryHeaders = buildHeaders(newToken);
    return fetch(url, { headers: retryHeaders, signal: AbortSignal.timeout(30000) });
  }

  return res;
}

async function fetchAllResoListings(): Promise<any[]> {
  const token = await getRealtyFeedToken();
  const all: any[] = [];
  let nextUrl: string | null =
    `${REALTYFEED_API_BASE}/Property?$filter=StandardStatus eq 'Active'&$top=200&$select=${RESO_SELECT_FIELDS}&$expand=Media`;

  while (nextUrl) {
    const res = await realtyFeedODataFetch(nextUrl, token);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`RealtyFeed RESO API → HTTP ${res.status}: ${errBody.slice(0, 400)}`);
    }

    const body = await res.json();
    const records = body.value || [];
    all.push(...records);

    const count = body["@odata.count"];
    const pageInfo = count ? ` (total: ${count})` : "";
    console.log(`[IDX Sync] RealtyFeed fetched ${all.length} listings so far${pageInfo}...`);

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
      .filter((m: any) => m.MediaCategory === "Photo" || m.MediaType === "image/jpeg" || m.MediaURL)
      .sort((a: any, b: any) => (a.Order || 0) - (b.Order || 0));
    if (photoMedia.length > 0) {
      imageUrl = photoMedia[0].MediaURL || null;
      photos = photoMedia.map((m: any) => m.MediaURL).filter(Boolean);
    }
  }

  const bathsFull = parseInt(raw.BathroomsFull || raw.BathroomsTotalInteger || "0") || 0;
  const bathsHalf = parseInt(raw.BathroomsHalf || "0") || 0;
  const baths = String(bathsFull + bathsHalf * 0.5);

  const agentName = raw.ListAgentFullName ||
    (raw.ListAgentFirstName ? `${raw.ListAgentFirstName || ""} ${raw.ListAgentLastName || ""}`.trim() : null);

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
    listingAgentName: agentName,
    listingAgentEmail: raw.ListAgentEmail || null,
    listingAgentPhone: raw.ListAgentDirectPhone || raw.ListAgentOfficePhone || null,
    listingBrokerage: raw.ListOfficeName || null,
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

let syncInProgress = false;

export async function runIdxSync(): Promise<{ added: number; updated: number; removed: number; total: number }> {
  if (syncInProgress) throw new Error("Sync already in progress");
  if (!idxConfigured()) throw new Error("IDX not configured — set IDX_RESO_CLIENT_ID + IDX_RESO_CLIENT_SECRET, or IDX_BROKER_API_KEY");

  syncInProgress = true;

  const [log] = await db.insert(idxSyncLog).values({ status: "running" }).returning();

  try {
    console.log("[IDX Sync] Starting…");

    let rawListings: any[];
    let useReso = false;

    if (realtyFeedConfigured()) {
      console.log("[IDX Sync] Using RealtyFeed RESO OData API (OAuth2)");
      rawListings = await fetchAllResoListings();
      useReso = true;
    } else if (IDX_KEY) {
      console.log("[IDX Sync] Using IDX Broker API (legacy)");
      rawListings = await fetchAllIdxListings();
    } else {
      throw new Error("No IDX/RESO credentials configured");
    }

    console.log(`[IDX Sync] Fetched ${rawListings.length} listings`);

    const normalised = rawListings
      .map(r => useReso ? normaliseReso(r) : normaliseIdxBroker(r))
      .filter(r => r.idxId && r.price > 0);

    const existingIdxRows = await db
      .select({ idxId: properties.idxId, id: properties.id })
      .from(properties)
      .where(eq(properties.source, "idx"));

    const existingMap = new Map(existingIdxRows.map(r => [r.idxId!, r.id]));
    const incomingIds = new Set(normalised.map(r => r.idxId));

    let added = 0, updated = 0, removed = 0;

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

  setTimeout(async () => {
    try { await runIdxSync(); }
    catch (e: any) { console.error("[IDX Sync] Startup sync failed:", e.message); }
  }, 30_000);

  setInterval(async () => {
    try { await runIdxSync(); }
    catch (e: any) { console.error("[IDX Sync] Scheduled sync failed:", e.message); }
  }, FOUR_HOURS);
}
