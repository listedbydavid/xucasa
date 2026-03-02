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

export function idxConfigured(): boolean {
  return !!(IDX_KEY || (RESO_URL && RESO_TOKEN));
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
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IDX API ${endpoint} → HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Fetch ALL active listings from IDX Broker, paginated.
 * IDX Broker returns max 500 per page.
 */
async function fetchAllIdxListings(): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  const pageSize = 500;

  while (true) {
    const page = await idxFetch("/clients/listings", {
      start: String(start),
      limit: String(pageSize),
      filterField: "listingStatus",
      filterValue: "Active",
    });

    const listings = Array.isArray(page) ? page : Object.values(page);
    if (!listings.length) break;

    all.push(...listings);
    if (listings.length < pageSize) break; // last page
    start += pageSize;

    // Be gentle with the API
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

// ── RESO Web API helpers ──────────────────────────────────────────────────────

async function fetchAllResoListings(): Promise<any[]> {
  const all: any[] = [];
  let nextUrl: string | null = `${RESO_URL}/Property?$filter=StandardStatus eq 'Active'&$top=200&$select=ListingKey,ListingId,ListPrice,BedroomsTotal,BathroomsTotalInteger,LivingArea,LotSizeSquareFeet,StreetNumber,StreetName,UnitNumber,City,StateOrProvince,PostalCode,Latitude,Longitude,PublicRemarks,PhotosCount,ListDate,AssociationFee,MlsStatus`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${RESO_TOKEN}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`RESO API → HTTP ${res.status}`);
    const body = await res.json();
    const records = body.value || [];
    all.push(...records);
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
  return {
    idxId: String(raw.ListingKey || raw.ListingId || ""),
    mlsNumber: raw.ListingId || null,
    title: `${raw.StreetNumber || ""} ${raw.StreetName || ""}, ${raw.City || ""}`.trim(),
    description: raw.PublicRemarks || `MLS listing at ${raw.StreetNumber} ${raw.StreetName}, ${raw.City}.`,
    price: parseInt(raw.ListPrice || "0") || 0,
    addressStreetNumber: raw.StreetNumber || null,
    addressStreetName: raw.StreetName || null,
    addressUnitNumber: raw.UnitNumber || null,
    addressCity: raw.City || null,
    addressState: raw.StateOrProvince || null,
    addressZip: raw.PostalCode || null,
    location: `${raw.City || ""}, ${raw.StateOrProvince || ""}`,
    beds: parseInt(raw.BedroomsTotal || "0") || 0,
    baths: String(parseFloat(raw.BathroomsTotalInteger || "0")),
    sqft: parseInt(raw.LivingArea || "0") || 0,
    lotSize: parseInt(raw.LotSizeSquareFeet || "0") || null,
    hoaFee: raw.AssociationFee ? parseInt(raw.AssociationFee) : null,
    lat: raw.Latitude ? String(raw.Latitude) : null,
    lng: raw.Longitude ? String(raw.Longitude) : null,
    imageUrl: null,
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
  if (!idxConfigured()) throw new Error("IDX not configured — set IDX_BROKER_API_KEY (or IDX_RESO_URL + IDX_RESO_TOKEN)");

  syncInProgress = true;

  // Create log entry
  const [log] = await db.insert(idxSyncLog).values({ status: "running" }).returning();

  try {
    console.log("[IDX Sync] Starting…");

    // Fetch raw listings from whichever source is configured
    let rawListings: any[];
    if (IDX_KEY) {
      console.log("[IDX Sync] Using IDX Broker API");
      rawListings = await fetchAllIdxListings();
    } else {
      console.log("[IDX Sync] Using RESO Web API");
      rawListings = await fetchAllResoListings();
    }

    console.log(`[IDX Sync] Fetched ${rawListings.length} listings`);

    // Normalise
    const normalised = rawListings
      .map(r => IDX_KEY ? normaliseIdxBroker(r) : normaliseReso(r))
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
    console.log("[IDX Sync] Not configured — skipping auto-sync. Add IDX_BROKER_API_KEY to activate.");
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
