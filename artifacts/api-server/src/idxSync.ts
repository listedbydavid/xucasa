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
 * Geographic filter: San Diego metro (~50km radius from downtown)
 * Batch upserts: Uses ON CONFLICT (idx_id) DO UPDATE for speed
 *
 * Env vars:
 *   IDX_RESO_CLIENT_ID      – RealtyFeed client_id
 *   IDX_RESO_CLIENT_SECRET  – RealtyFeed client_secret
 *   IDX_REALTYFEED_API_KEY  – RealtyFeed API key (optional, for x-api-key header)
 *   IDX_BROKER_API_KEY      – Legacy IDX Broker key (fallback)
 */

import { db } from "./db";
import { properties, idxSyncLog, notifications } from "@workspace/db";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import { notifySavedPropertyPriceDrops } from "./lib/priceDropNotifications";
import { logger } from "./logger";

const IDX_BASE = "https://middleware.idxbroker.com/api";
const IDX_KEY = process.env.IDX_BROKER_API_KEY || "";

const RESO_CLIENT_ID = process.env.IDX_RESO_CLIENT_ID || "";
const RESO_CLIENT_SECRET = process.env.IDX_RESO_CLIENT_SECRET || "";
const RESO_API_KEY = process.env.IDX_REALTYFEED_API_KEY || "";

const REALTYFEED_TOKEN_URL = "https://api.realtyfeed.com/v1/auth/token";
export const REALTYFEED_API_BASE = "https://api.realtyfeed.com/reso/odata";

const SD_CENTER_LAT = 32.7157;
const SD_CENTER_LNG = -117.1611;
const SD_RADIUS_KM = 50;

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

  const data = await res.json() as any;
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

export async function getRealtyFeedToken(): Promise<string> {
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
    Origin: "https://www.xucasa.com",
    Referer: "https://www.xucasa.com",
  };
  if (RESO_API_KEY) {
    headers["x-api-key"] = RESO_API_KEY;
  }
  return headers;
}

// ── Agent verification via RealtyFeed Member API ─────────────────────────────

export interface AgentVerifyResult {
  verified: boolean;
  memberKey?: string;
  memberName?: string;
  officeName?: string;
  memberEmail?: string;
  memberPhone?: string;
  error?: string;
}

function sanitizeODataString(input: string): string {
  return input.replace(/'/g, "''").replace(/[\\%\x00-\x1f]/g, "");
}

function isValidLicenseNumber(license: string): boolean {
  return /^[A-Za-z0-9\-. ]{2,30}$/.test(license);
}

function isValidState(state: string): boolean {
  const validStates = new Set([
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
  ]);
  return validStates.has(state.toUpperCase());
}

export async function verifyAgentLicense(licenseNumber: string, state?: string): Promise<AgentVerifyResult> {
  if (!realtyFeedConfigured()) {
    return { verified: false, error: "MLS API not configured" };
  }

  if (!isValidLicenseNumber(licenseNumber)) {
    return { verified: false, error: "Invalid license number format" };
  }

  if (state && !isValidState(state)) {
    return { verified: false, error: "Invalid state code" };
  }

  try {
    const token = await getRealtyFeedToken();
    const headers = buildHeaders(token);

    const safeLicense = sanitizeODataString(licenseNumber);
    const filter = `MemberStateLicense eq '${safeLicense}'`;

    const url = `${REALTYFEED_API_BASE}/Member?$filter=${encodeURIComponent(filter)}&$top=10&$select=MemberKey,MemberFullName,MemberFirstName,MemberLastName,MemberEmail,MemberDirectPhone,MemberStateLicense,MemberStateOrProvince,OfficeName,OfficeKey`;

    console.log(`[Agent Verify] Looking up license ${licenseNumber}${state ? ` in ${state}` : ""}...`);

    let res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

    if (res.status === 401 || res.status === 403) {
      const newToken = await forceRefreshToken();
      const retryHeaders = buildHeaders(newToken);
      res = await fetch(url, { headers: retryHeaders, signal: AbortSignal.timeout(15000) });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log(`[Agent Verify] API error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
      return { verified: false, error: `MLS API returned HTTP ${res.status}` };
    }

    const body = await res.json() as any;
    let members = body.value || [];

    if (members.length === 0) {
      console.log(`[Agent Verify] No member found for license ${licenseNumber}`);
      return { verified: false, error: "No agent found with that license number" };
    }

    const stateNameMap: Record<string, string> = {
      AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
      CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
      HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
      KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
      MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
      MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
      NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
      OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
      SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
      VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
      DC: "District of Columbia",
    };

    if (state) {
      const stateUpper = state.toUpperCase();
      const stateName = stateNameMap[stateUpper] || stateUpper;
      const filtered = members.filter((m: any) => {
        const mState = (m.MemberStateOrProvince || "").trim().toLowerCase();
        return mState === stateUpper.toLowerCase() || mState === stateName.toLowerCase();
      });
      if (filtered.length > 0) members = filtered;
    }

    const member = members.find((m: any) =>
      m.MemberStateLicense && m.MemberStateLicense.trim().toLowerCase() === licenseNumber.trim().toLowerCase()
    ) || members[0];

    if (member.MemberStateLicense?.trim().toLowerCase() !== licenseNumber.trim().toLowerCase()) {
      console.log(`[Agent Verify] License mismatch: searched "${licenseNumber}", got "${member.MemberStateLicense}"`);
      return { verified: false, error: "License number did not match any MLS records exactly" };
    }

    const memberName = member.MemberFullName ||
      `${member.MemberFirstName || ""} ${member.MemberLastName || ""}`.trim();

    console.log(`[Agent Verify] Found agent: ${memberName} (Key: ${member.MemberKey}, License: ${member.MemberStateLicense})`);

    return {
      verified: true,
      memberKey: member.MemberKey || undefined,
      memberName: memberName || undefined,
      officeName: member.OfficeName || undefined,
      memberEmail: member.MemberEmail || undefined,
      memberPhone: member.MemberDirectPhone || undefined,
    };
  } catch (err: any) {
    console.error(`[Agent Verify] Error:`, err.message);
    return { verified: false, error: err.message };
  }
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

    const raw = Array.isArray(page) ? page as any[] : Object.values(page as any);
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
  "ListDate", "CloseDate", "ClosePrice", "AssociationFee", "MlsStatus", "StandardStatus",
  "PropertyType", "PropertySubType", "YearBuilt",
  "ListAgentFullName", "ListAgentFirstName", "ListAgentLastName",
  "ListAgentEmail", "ListAgentDirectPhone", "ListAgentOfficePhone",
  "ListAgentKey", "ListAgentMlsId", "ListAgentStateLicense",
  "ListOfficeName", "ListOfficeMlsId", "ListOfficePhone",
  "CoListAgentFullName", "CoListAgentEmail", "CoListAgentDirectPhone",
  "PrivateRemarks", "ShowingInstructions",
  "ShowingContactName", "ShowingContactPhone",
  "LockBoxType", "AccessCode",
  "BuyerAgencyCompensation", "SpecialListingConditions",
  "VirtualTourURLUnbranded", "VirtualTourURLBranded",
].join(",");

export async function realtyFeedODataFetch(url: string, token: string): Promise<Response> {
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

function buildGeoFilter(): string {
  return `StandardStatus eq 'Active' and geo.distance(Coordinates, POINT(${SD_CENTER_LNG} ${SD_CENTER_LAT})) lt ${SD_RADIUS_KM}km`;
}

async function fetchAllResoListings(): Promise<any[]> {
  const token = await getRealtyFeedToken();
  const all: any[] = [];
  const geoFilter = buildGeoFilter();
  let nextUrl: string | null =
    `${REALTYFEED_API_BASE}/Property?$filter=${encodeURIComponent(geoFilter)}&$top=200&$select=${RESO_SELECT_FIELDS}&$expand=Media`;

  console.log(`[IDX Sync] Geo filter: ${SD_RADIUS_KM}km radius from San Diego (${SD_CENTER_LAT}, ${SD_CENTER_LNG})`);

  while (nextUrl) {
    const res = await realtyFeedODataFetch(nextUrl, token);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`RealtyFeed RESO API → HTTP ${res.status}: ${errBody.slice(0, 400)}`);
    }

    const body = await res.json() as any;
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

/**
 * Output of the per-row normalisation step. `isLease` is a transient flag we
 * use to filter out rentals before upsert; it is stripped from the row before
 * it reaches the DB layer (the `properties` table has no such column).
 */
type NormalisedListing = {
  idxId: string;
  price: number;
  isLease: boolean;
  [key: string]: any;
};

function normaliseIdxBroker(raw: any): NormalisedListing {
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
    addressCounty: raw.county || raw.countyName || null,
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
    propertyType: normalisePropertyType(raw.propertyType, raw.propertySubType),
    isLease: isLeasePropertyType(raw.propertyType, raw.propertySubType),
  };
}

function sanitizeTourUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normaliseReso(raw: any): NormalisedListing {
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

  let virtualTourUrl: string | null = sanitizeTourUrl(raw.VirtualTourURLUnbranded) || sanitizeTourUrl(raw.VirtualTourURLBranded) || null;
  let mlsDocuments: any[] | null = null;
  if (raw.Media && Array.isArray(raw.Media)) {
    if (!virtualTourUrl) {
      const tourMedia = raw.Media.find((m: any) => {
        const cat = (m.MediaCategory || "").toLowerCase();
        return cat === "virtual tour" || cat === "virtualtour" || cat === "3d tour" || cat === "video tour";
      });
      if (tourMedia && tourMedia.MediaURL) {
        virtualTourUrl = sanitizeTourUrl(tourMedia.MediaURL);
      }
    }
    const docMedia = raw.Media
      .filter((m: any) => {
        const cat = (m.MediaCategory || "").toLowerCase();
        return cat === "document" || cat === "supplement" || cat === "pdf" || cat === "brochure";
      })
      .map((m: any) => ({
        url: m.MediaURL,
        name: m.ShortDescription || m.MediaCategory || "Document",
        type: m.MediaCategory || "Document",
      }))
      .filter((d: any) => d.url);
    if (docMedia.length > 0) mlsDocuments = docMedia;
  }

  const coAgentName = raw.CoListAgentFullName || null;
  const rawStatus = String(raw.StandardStatus || raw.MlsStatus || "active").toLowerCase().replace(/[\s-]+/g, "_");
  const listingStatus = rawStatus === "coming_soon" ? "coming_soon"
    : rawStatus === "pending" ? "pending"
    : rawStatus === "closed" || rawStatus === "sold" ? "sold"
    : rawStatus === "off_market" || rawStatus === "expired" || rawStatus === "cancelled" ? "off_market"
    : "active";

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
    addressCounty: raw.CountyOrParish || null,
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
    status: listingStatus,
    source: "idx" as const,
    isOffMarket: false,
    listDate: raw.ListDate ? new Date(raw.ListDate) : null,
    closeDate: raw.CloseDate ? new Date(raw.CloseDate) : null,
    closePrice: raw.ClosePrice ? parseInt(raw.ClosePrice, 10) || null : null,
    listingAgentName: agentName,
    listingAgentEmail: raw.ListAgentEmail || null,
    listingAgentPhone: raw.ListAgentDirectPhone || raw.ListAgentOfficePhone || null,
    listingBrokerage: raw.ListOfficeName || null,
    propertyType: normalisePropertyType(raw.PropertyType, raw.PropertySubType),
    isLease: isLeasePropertyType(raw.PropertyType, raw.PropertySubType),
    confidentialRemarks: raw.PrivateRemarks || null,
    showingInstructions: raw.ShowingInstructions || null,
    showingContactName: raw.ShowingContactName || null,
    showingContactPhone: raw.ShowingContactPhone || null,
    lockboxType: raw.LockBoxType || null,
    accessInstructions: raw.AccessCode || null,
    // Agent verification stores RESO MemberKey, so ListAgentKey is the
    // canonical attribution value. ListAgentMlsId is only a legacy fallback.
    listingAgentMlsId: raw.ListAgentKey || raw.ListAgentMlsId || null,
    listingAgentLicenseNumber: raw.ListAgentStateLicense || null,
    coListingAgentName: coAgentName,
    coListingAgentEmail: raw.CoListAgentEmail || null,
    coListingAgentPhone: raw.CoListAgentDirectPhone || null,
    listingOfficeMlsId: raw.ListOfficeMlsId || null,
    listingOfficePhone: raw.ListOfficePhone || null,
    buyerAgentCommission: raw.BuyerAgencyCompensation || null,
    specialConditions: raw.SpecialListingConditions || null,
    mlsDocuments,
    virtualTourUrl,
  };
}

/**
 * Detects rental/lease listings (e.g. "Residential Lease", "Rental", "Lease").
 * These should not appear in for-sale buyer flows.
 */
export function isLeasePropertyType(type?: string | null, subType?: string | null): boolean {
  const combined = `${type || ""} ${subType || ""}`.toLowerCase();
  return /\b(lease|rental|for rent)\b/.test(combined);
}

export function normalisePropertyType(type?: string | null, subType?: string | null): string | null {
  if (isLeasePropertyType(type, subType)) return "Rental";
  const t = (subType || type || "").toLowerCase().trim();
  if (!t) return null;
  if (t.includes("single") || t.includes("detached")) return "SFH";
  if (t.includes("condo")) return "Condo";
  if (t.includes("townho") || t.includes("town ho")) return "Townhome";
  if (t.includes("land") || t.includes("lot") || t.includes("vacant")) return "Land";
  if (t.includes("income") || t.includes("duplex") || t.includes("triplex") || t.includes("fourplex") || t.includes("quadruplex")) return "2-4 Unit";
  if (t.includes("multi") || t.includes("apart") || t.includes("5+")) return "Multi-Family";
  if (t.includes("mobile") || t.includes("manufactured")) return "Mobile";
  if (t.includes("commercial")) return "Commercial";
  if (t.includes("farm") || t.includes("ranch")) return "Farm/Ranch";
  // Generic "Residential" with no further qualifier → assume single-family home
  if (t.includes("residential")) return "SFH";
  return type || subType || null;
}

// ── Batch upsert helpers ──────────────────────────────────────────────────────

const BATCH_SIZE = 50;

function deduplicateByIdxId(listings: any[]): any[] {
  const map = new Map<string, any>();
  for (const listing of listings) {
    map.set(listing.idxId, listing);
  }
  return Array.from(map.values());
}

async function batchUpsertListings(normalised: any[]): Promise<{
  added: number;
  updated: number;
  /** Maps idxId → DB property.id for every row touched in this sync. */
  idxIdToDbId: Map<string, number>;
}> {
  const deduped = deduplicateByIdxId(normalised);
  if (deduped.length !== normalised.length) {
    console.log(`[IDX Sync] Deduplicated ${normalised.length} → ${deduped.length} listings (removed ${normalised.length - deduped.length} duplicates)`);
  }

  const existingIdxRows = await db
    .select({
      idxId: properties.idxId,
      id: properties.id,
      price: properties.price,
      priceUpdatedAt: properties.priceUpdatedAt,
    })
    .from(properties)
    .where(eq(properties.source, "idx"));

  const existingMap = new Map(existingIdxRows.map(r => [r.idxId!, {
    id: r.id,
    price: r.price,
    priceUpdatedAt: r.priceUpdatedAt,
  }]));
  const priceDrops: Array<{ id: number; oldPrice: number; newPrice: number; eventKey: string }> = [];

  // idxId → DB id for all rows upserted in this run (populated as we go)
  const idxIdToDbId = new Map<string, number>();

  // Seed with pre-existing IDs (updates keep the same id)
  for (const [idxId, row] of existingMap) {
    idxIdToDbId.set(idxId, row.id);
  }

  let added = 0;
  let updated = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const listing of batch) {
      const existing = existingMap.get(listing.idxId);
      // Always keep listingStatus in sync with status for IDX rows so the
      // transition step and buyer-side queries see a consistent value.
      const payload = { ...listing, listingStatus: listing.status, idxUpdatedAt: new Date() };

      if (existing) {
        if (payload.price !== existing.price) payload.priceUpdatedAt = new Date();
        toUpdate.push({ id: existing.id, ...payload });
        if (payload.price < existing.price) {
          priceDrops.push({
            id: existing.id,
            oldPrice: existing.price,
            newPrice: payload.price,
            eventKey: `${existing.price}:${payload.price}:${existing.priceUpdatedAt?.toISOString() ?? "legacy"}`,
          });
        }
      } else {
        toInsert.push(payload);
      }
    }

    if (toInsert.length > 0) {
      // Use RETURNING to capture the auto-generated DB ids for new rows
      const inserted = await db.insert(properties).values(toInsert).returning({
        id: properties.id,
        idxId: properties.idxId,
      });
      for (const row of inserted) {
        if (row.idxId) idxIdToDbId.set(row.idxId, row.id);
      }
      added += toInsert.length;
    }

    if (toUpdate.length > 0) {
      for (let j = 0; j < toUpdate.length; j += 10) {
        const updateBatch = toUpdate.slice(j, j + 10);
        await Promise.all(
          updateBatch.map(({ id, ...payload }) =>
            db.update(properties).set(payload).where(eq(properties.id, id))
          )
        );
      }
      updated += toUpdate.length;
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= deduped.length) {
      console.log(`[IDX Sync] Upserted ${Math.min(i + BATCH_SIZE, deduped.length)}/${deduped.length} listings...`);
    }
  }

  try {
    await notifySavedPropertyPriceDrops(priceDrops);
  } catch (error) {
    logger.error({
      event: "idx_price_drop_notifications_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { added, updated, idxIdToDbId };
}

// ── IDX Transition: archive manual listings that went live on the MLS ─────────

/**
 * Eligible listingStatus values for manual agent listings that may transition
 * to the live MLS feed (IDX). Only pre-MLS and non-active statuses are
 * considered; we never touch already-live or buyer-offer-stage listings.
 */
const ARCHIVABLE_LISTING_STATUSES = new Set(["off_market", "coming_soon", "pre_market"]);

/**
 * Normalise a full street address to a canonical pipe-delimited lowercase key
 * for deterministic matching.
 *
 * Returns an empty string when ANY of the five required components
 * (street number, street name, city, state, five-digit zip) is missing or
 * blank after normalisation — partial addresses must never produce a match.
 *
 * Expands common street-type abbreviations so "123 Main St" and
 * "123 Main Street" resolve to the same key.
 *
 * Exported for unit tests.
 */
export function normaliseAddress(parts: {
  streetNumber?: string | null;
  streetName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const { streetNumber, streetName, city, state, zip } = parts;

  const normNum = (streetNumber || "").trim().toLowerCase();

  // Normalise street name: expand common abbreviations then clean punctuation
  const normStreet = (streetName || "")
    .toLowerCase()
    .replace(/\bst\b/g, "street")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bblvd\b/g, "boulevard")
    .replace(/\bdr\b/g, "drive")
    .replace(/\brd\b/g, "road")
    .replace(/\bln\b/g, "lane")
    .replace(/\bct\b/g, "court")
    .replace(/\bpl\b/g, "place")
    .replace(/\bway\b/g, "way")
    .replace(/[.,#\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normCity = (city || "").trim().toLowerCase();
  const normState = (state || "").trim().toLowerCase();
  // Keep only digits, truncate to five-digit ZIP
  const normZip = (zip || "").trim().replace(/\D/g, "").slice(0, 5);

  // ALL five components must be present — any missing component returns "" so
  // the caller knows not to add this address to the lookup map.
  if (!normNum || !normStreet || !normCity || !normState || normZip.length < 5) {
    return "";
  }

  return [normNum, normStreet, normCity, normState, normZip].join("|");
}

/**
 * After a successful MLS sync, scan for agent-owned manual listings that have
 * just appeared in the current incoming sync batch. Match by:
 *   1. expectedMlsNumber (exact, case-insensitive) — highest confidence
 *   2. Normalised full address (all five components required) — fallback
 *
 * Only listings with listingStatus in {off_market, coming_soon, pre_market}
 * are eligible. Matched listings are archived and the owning agent is notified
 * via the in-app notification system. Buyer-agent authority is never touched.
 *
 * @param incomingNormalisedRows  The normalised rows from the current sync
 *   batch (same objects passed to batchUpsertListings), each carrying their
 *   DB id after upsert. Pass the post-upsert DB rows so we have real IDs.
 *
 * Returns the count of rows successfully written to the DB as archived.
 */
export async function archiveManualListingsMatchedByMls(
  incomingIdxRows: Array<{
    id: number;
    mlsNumber: string | null;
    addressStreetNumber: string | null;
    addressStreetName: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
  }>
): Promise<{ archived: number }> {
  if (incomingIdxRows.length === 0) return { archived: 0 };

  // Load all manual listings that are eligible for archiving
  const manualCandidates = await db
    .select({
      id: properties.id,
      agentId: properties.agentId,
      expectedMlsNumber: properties.expectedMlsNumber,
      addressStreetNumber: properties.addressStreetNumber,
      addressStreetName: properties.addressStreetName,
      addressCity: properties.addressCity,
      addressState: properties.addressState,
      addressZip: properties.addressZip,
      listingStatus: properties.listingStatus,
      title: properties.title,
    })
    .from(properties)
    .where(
      and(
        eq(properties.source, "manual"),
        sql`LOWER(${properties.listingStatus}) IN ('off_market', 'coming_soon', 'pre_market')`
      )
    );

  if (manualCandidates.length === 0) return { archived: 0 };

  // Build lookup maps from the incoming sync batch only.
  // Map 1: mlsNumber (lowercase, trimmed) → IDX DB row id
  const mlsNumberMap = new Map<string, number>();
  // Map 2: normalised full address (all five parts required) → IDX DB row id
  const addressMap = new Map<string, number>();

  for (const row of incomingIdxRows) {
    if (row.mlsNumber) {
      mlsNumberMap.set(row.mlsNumber.toLowerCase().trim(), row.id);
    }
    const normAddr = normaliseAddress({
      streetNumber: row.addressStreetNumber,
      streetName: row.addressStreetName,
      city: row.addressCity,
      state: row.addressState,
      zip: row.addressZip,
    });
    // normaliseAddress returns "" when any component is missing — skip those
    if (normAddr) {
      addressMap.set(normAddr, row.id);
    }
  }

  const toArchive: Array<{
    manualId: number;
    idxPropertyId: number;
    agentId: string | null;
    title: string;
    matchedBy: string;
  }> = [];

  for (const candidate of manualCandidates) {
    // Guard: status filter already applied in DB query, but validate in-memory
    // too so the logic is explicit and testable without a DB.
    if (!ARCHIVABLE_LISTING_STATUSES.has((candidate.listingStatus || "").toLowerCase())) {
      continue;
    }

    let idxPropertyId: number | null = null;
    let matchedBy = "";

    // Priority 1: exact MLS number match
    if (candidate.expectedMlsNumber) {
      const key = candidate.expectedMlsNumber.toLowerCase().trim();
      const found = mlsNumberMap.get(key);
      if (found !== undefined) {
        idxPropertyId = found;
        matchedBy = "mls_number";
      }
    }

    // Priority 2: normalised address match (only when MLS number did not match)
    if (idxPropertyId === null) {
      const normAddr = normaliseAddress({
        streetNumber: candidate.addressStreetNumber,
        streetName: candidate.addressStreetName,
        city: candidate.addressCity,
        state: candidate.addressState,
        zip: candidate.addressZip,
      });
      // "" means an incomplete address on the manual side — skip
      if (normAddr) {
        const found = addressMap.get(normAddr);
        if (found !== undefined) {
          idxPropertyId = found;
          matchedBy = "address";
        }
      }
    }

    if (idxPropertyId !== null) {
      toArchive.push({
        manualId: candidate.id,
        idxPropertyId,
        agentId: candidate.agentId ?? null,
        title: candidate.title,
        matchedBy,
      });
    }
  }

  if (toArchive.length === 0) return { archived: 0 };

  const now = new Date();
  let archived = 0;

  // Archive each matched listing and notify the owning agent.
  // Count only rows where the DB write succeeds.
  for (const item of toArchive) {
    try {
      await db
        .update(properties)
        .set({
          listingStatus: "archived",
          status: "archived",
          archivedAt: now,
          archivedReason: `Listing went live on MLS (matched by ${item.matchedBy}). IDX property ID: ${item.idxPropertyId}.`,
          linkedMlsPropertyId: item.idxPropertyId,
        })
        .where(eq(properties.id, item.manualId));

      archived++;

      logger.info({
        event: "idx_transition_archived",
        manualId: item.manualId,
        idxPropertyId: item.idxPropertyId,
        title: item.title,
        matchedBy: item.matchedBy,
      });

      // Notify the owning agent (best-effort; never throw on notification failure)
      if (item.agentId) {
        try {
          await db.insert(notifications).values({
            userId: item.agentId,
            type: "system",
            title: "Your listing is now live on the MLS",
            message: `Your manual listing "${item.title}" has been automatically archived because it now appears in the MLS feed. The live IDX listing (property #${item.idxPropertyId}) is now the active record.`,
            propertyId: item.idxPropertyId,
            linkUrl: `/property/${item.idxPropertyId}`,
            read: false,
            archived: false,
          });
        } catch (notifErr: any) {
          logger.error({
            event: "idx_transition_notification_failed",
            manualId: item.manualId,
            agentId: item.agentId,
            error: notifErr.message,
          });
        }
      }
    } catch (archiveErr: any) {
      logger.error({
        event: "idx_transition_archive_failed",
        manualId: item.manualId,
        error: archiveErr.message,
      });
    }
  }

  return { archived };
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

    console.log(`[IDX Sync] Fetched ${rawListings.length} listings from API`);

    const allNormalised: NormalisedListing[] = rawListings
      .map(r => useReso ? normaliseReso(r) : normaliseIdxBroker(r))
      .filter((r): r is NormalisedListing => Boolean(r.idxId) && r.price > 0);

    // Skip rentals — both explicitly tagged ("Residential Lease") and price-based
    // (anything below $20k in San Diego is a monthly rental, not a sale price,
    // even when miscategorised in the feed as Commercial / SFH / etc).
    const RENTAL_PRICE_THRESHOLD = 20_000;
    const leaseCount = allNormalised.filter(r => r.isLease).length;
    const lowPriceCount = allNormalised.filter(r => !r.isLease && r.price < RENTAL_PRICE_THRESHOLD).length;
    const normalised = allNormalised
      .filter(r => !r.isLease && r.price >= RENTAL_PRICE_THRESHOLD)
      .map(({ isLease: _isLease, ...rest }) => rest);

    console.log(`[IDX Sync] ${normalised.length} valid for-sale listings after normalisation (filtered ${rawListings.length - allNormalised.length} with no price, ${leaseCount} tagged rentals, ${lowPriceCount} sub-$${RENTAL_PRICE_THRESHOLD} likely rentals)`);

    const { added, updated, idxIdToDbId } = await batchUpsertListings(normalised);

    // ── IDX Transition: archive manual pre-MLS listings that went live ────────
    // Build the incoming rows entirely from in-memory data (normalised + the
    // idxId→DB-id map returned by batchUpsertListings) so we only match against
    // listings present in the current sync batch, not historical IDX rows.
    try {
      const incomingIdxRows = normalised
        .map(r => {
          const dbId = idxIdToDbId.get(r.idxId);
          if (dbId === undefined) return null;
          return {
            id: dbId,
            mlsNumber: (r.mlsNumber as string | null) ?? null,
            addressStreetNumber: (r.addressStreetNumber as string | null) ?? null,
            addressStreetName: (r.addressStreetName as string | null) ?? null,
            addressCity: (r.addressCity as string | null) ?? null,
            addressState: (r.addressState as string | null) ?? null,
            addressZip: (r.addressZip as string | null) ?? null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const { archived } = await archiveManualListingsMatchedByMls(incomingIdxRows);
      if (archived > 0) {
        logger.info({
          event: "idx_transition_complete",
          archived,
        });
      }
    } catch (transitionErr: any) {
      // Non-fatal: log and continue so the sync result is still reported.
      logger.error({
        event: "idx_transition_step_failed",
        error: transitionErr.message,
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Re-query to find IDX rows that were NOT in this sync and mark removed.
    // This query happens after the transition step intentionally (archived manual
    // listings are source=manual, not source=idx, so they are not affected).
    const existingIdxRows = await db
      .select({ idxId: properties.idxId, id: properties.id })
      .from(properties)
      .where(eq(properties.source, "idx"));

    const incomingIds = new Set(normalised.map(r => r.idxId));
    const toRemove = existingIdxRows
      .filter(r => r.idxId && !incomingIds.has(r.idxId))
      .map(r => r.id);

    let removed = 0;
    if (toRemove.length) {
      for (let i = 0; i < toRemove.length; i += 500) {
        const batch = toRemove.slice(i, i + 500);
        await db
          .update(properties)
          .set({ status: "removed" })
          .where(inArray(properties.id, batch));
      }
      removed = toRemove.length;
    }

    const total = normalised.length;
    console.log(`[IDX Sync] Done — added: ${added}, updated: ${updated}, removed: ${removed}, total: ${total}`);

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

/**
 * Imports only one verified agent's listing-side MLS transactions. Unlike the
 * global sync this never performs absent-row reconciliation, so historic Closed
 * records cannot affect manual-listing archive/matching lifecycle behavior.
 */
export async function importAgentResoTransactions(agentMlsId: string): Promise<number> {
  if (!realtyFeedConfigured() || !agentMlsId) return 0;
  const token = await getRealtyFeedToken();
  const escapedId = sanitizeODataString(agentMlsId);
  const fiveYearStart = new Date(Date.UTC(new Date().getUTCFullYear() - 4, 0, 1)).toISOString();
  const filter = `(ListAgentKey eq '${escapedId}') and (StandardStatus eq 'Active' or StandardStatus eq 'Pending' or (StandardStatus eq 'Closed' and CloseDate ge ${fiveYearStart}))`;
  let nextUrl: string | null = `${REALTYFEED_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$top=200&$select=${RESO_SELECT_FIELDS}&$expand=Media`;
  const listings: any[] = [];
  while (nextUrl) {
    const response = await realtyFeedODataFetch(nextUrl, token);
    if (!response.ok) throw new Error(`MLS transaction import failed (${response.status})`);
    const body = await response.json() as any;
    listings.push(...(body.value || []));
    nextUrl = body["@odata.nextLink"] || null;
  }
  const normalised = listings.map(normaliseReso).filter(row => row.idxId && !row.isLease);
  if (!normalised.length) return 0;
  const result = await batchUpsertListings(normalised);
  return result.added + result.updated;
}

// ── Backfill: reclassify legacy rental rows ──────────────────────────────────

/**
 * One-shot backfill: rentals were previously ingested as for-sale listings
 * (often with propertyType "SFH" / "Single Family" / "Multi-Family") with the
 * monthly rent in the price column. We don't have the original RESO PropertyType
 * stored, so use a price heuristic: any IDX listing under $20,000 is almost
 * certainly a monthly rental in the San Diego market. Mark them as rental so
 * buyer-side queries can exclude them.
 */
export async function backfillRentalReclassification(): Promise<{ updated: number }> {
  const result = await db
    .update(properties)
    .set({ status: "rental", propertyType: "Rental" })
    .where(sql`${properties.source} = 'idx'
      AND ${properties.price} > 0
      AND ${properties.price} < 20000
      AND ${properties.status} <> 'rental'`)
    .returning({ id: properties.id });
  if (result.length > 0) {
    console.log(`[IDX Sync] Reclassified ${result.length} legacy rental rows (price < $20k) as rentals`);
  }
  return { updated: result.length };
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
