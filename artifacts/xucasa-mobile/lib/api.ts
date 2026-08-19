import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const COOKIE_KEY = 'xucasa.session';
const SESSION_TOKEN_KEY = 'xucasa.session-token';

/**
 * Resolve the API origin in priority order:
 *   1. EXPO_PUBLIC_API_URL — set explicitly for EAS builds and production deployments
 *   2. EXPO_PUBLIC_DOMAIN  — Replit dev-environment variable (development preview only)
 *
 * EAS build env vars are set in eas.json → build.<profile>.env.
 * For a production deployment, set EXPO_PUBLIC_API_URL to your deployed API origin
 * (e.g. "https://api.xucasa.com") in eas.json or via `eas env:create`.
 */
export const getBaseUrl = (): string => {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit && explicit !== 'undefined' && explicit !== '') return explicit;
  const replitDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (replitDomain && replitDomain !== 'undefined' && replitDomain !== '') {
    return `https://${replitDomain}`;
  }
  if (__DEV__) {
    console.warn('[xucasa] No API URL configured. Set EXPO_PUBLIC_API_URL in eas.json or .env.local');
  }
  return '';
};

// ─── Cookie jar ───────────────────────────────────────────────────────────────

async function getCookie(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(COOKIE_KEY);
}

async function getSessionToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function storeSessionToken(token?: string): Promise<void> {
  if (Platform.OS === 'web' || !token) return;
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

async function storeCookie(setCookieHeader: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const cookiePart = setCookieHeader.split(';')[0];
  if (!cookiePart) return;
  await SecureStore.setItemAsync(COOKIE_KEY, cookiePart);
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all([
    SecureStore.deleteItemAsync(COOKIE_KEY),
    SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
  ]);
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const sessionToken = await getSessionToken();
  const cookie = sessionToken ? null : await getCookie();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  // Native fetch needs the cookie jar explicitly. On web, Cookie is a
  // forbidden request header; the browser manages the session cookie when
  // credentials are included below.
  if (Platform.OS !== 'web') {
    headers['X-Xucasa-Client'] = 'native';
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    } else if (cookie) {
      headers.Cookie = cookie;
    }
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    // Avoid browser cache revalidation responses being surfaced as failed
    // API calls; React Query owns the client-side freshness policy.
    cache: Platform.OS === 'web' ? 'no-store' : options.cache,
    credentials: 'include',
    headers,
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) await storeCookie(setCookie);

  return response;
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 401) throw new ApiError(401, 'Unauthorized');
  if (!res.ok) throw new ApiError(res.status, `API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((err as any).message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((err as any).message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, `API error ${res.status}`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getPhotoUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
  return `${getBaseUrl()}${photo}`;
}

export function formatPrice(price: number | null | undefined): string {
  if (!price) return 'Price N/A';
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return `$${price.toLocaleString()}`;
}

export function isNewListing(listingDate: string | null | undefined): boolean {
  if (!listingDate) return false;
  const msPerDay = 86_400_000;
  return Date.now() - new Date(listingDate).getTime() < 7 * msPerDay;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number;
  type?: string;
  status?: string;
  photos?: string[];
  description?: string;
  mlsNumber?: string;
  listingDate?: string;
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
  latitude?: number;
  longitude?: number;
  isBuyItNow?: boolean;
  yearBuilt?: number;
  parkingSpaces?: number;
  hoaFee?: number;
}

/** Map raw API property fields (snake_case / prefixed) to the mobile Property type */
export function adaptProperty(raw: any): Property {
  return {
    id: raw.id,
    address:
      [raw.addressStreetNumber, raw.addressStreetName].filter(Boolean).join(' ') ||
      raw.address ||
      raw.location ||
      '',
    city: raw.addressCity ?? raw.city ?? '',
    state: raw.addressState ?? raw.state ?? '',
    zipCode: raw.addressZip ?? raw.zip ?? raw.zipCode ?? '',
    price: raw.price ?? 0,
    beds: raw.beds ?? 0,
    baths: raw.baths != null ? Number(raw.baths) : 0,
    sqft: raw.sqft ?? undefined,
    type: raw.propertyType ?? raw.type ?? undefined,
    status: raw.status ?? undefined,
    photos: raw.photos ?? [],
    description: raw.description ?? undefined,
    mlsNumber: raw.mlsNumber ?? undefined,
    listingDate: raw.listDate
      ? new Date(raw.listDate).toISOString()
      : (raw.idxUpdatedAt ?? raw.listingDate ?? undefined),
    agentName: raw.listingAgentName ?? raw.agentName ?? undefined,
    agentEmail: raw.listingAgentEmail ?? raw.agentEmail ?? undefined,
    agentPhone: raw.listingAgentPhone ?? raw.agentPhone ?? undefined,
    latitude: raw.latitude != null
      ? Number(raw.latitude)
      : (raw.lat != null ? Number(raw.lat) : undefined),
    longitude: raw.longitude != null
      ? Number(raw.longitude)
      : (raw.lng != null ? Number(raw.lng) : undefined),
    isBuyItNow: raw.isBuyItNow ?? false,
    yearBuilt: raw.yearBuilt ?? undefined,
    parkingSpaces: raw.parkingSpaces ?? undefined,
    hoaFee: raw.hoaFee ?? undefined,
  };
}

export interface SavedProperty {
  id: number;
  propertyId: number;
  property: Property;
  createdAt: string;
  priceDropAlerts?: boolean;
}

/** Friendly shape used by the mobile UI — populated by adaptConversation() */
export interface Conversation {
  id: number;
  otherUserId?: string;
  otherUserName?: string;
  otherUserEmail?: string;
  /** Plain-text preview of the last message */
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  propertyId?: number;
  propertyAddress?: string;
  subject?: string;
  /** raw server IDs retained for reference */
  buyerUserId?: string;
  agentUserId?: string;
}

/** Friendly shape used by the mobile UI — populated by adaptMessage() */
export interface Message {
  id: number;
  content: string;
  /** varchar string on the server — compare with User.id (also a string) */
  senderUserId: string;
  createdAt: string;
}

export interface User {
  /** varchar / string on the server (Replit SSO ID format) */
  id: string;
  sub?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  isAgent?: boolean;
  profileImageUrl?: string;
}

/** Map a raw API conversation record to the mobile Conversation type.
 *  Pass the current user's ID so we can pick the "other" participant. */
export function adaptConversation(raw: any, currentUserId: string): Conversation {
  const isBuyer = raw.buyerUserId === currentUserId;
  const other: any = isBuyer ? raw.agent : raw.buyer;
  const otherUserName = other
    ? [other.firstName, other.lastName].filter(Boolean).join(' ').trim() || other.email || undefined
    : undefined;
  const otherUserEmail: string | undefined = other?.email ?? undefined;

  // lastMessage may be a Message object or already a string
  let lastMessage: string | undefined;
  if (raw.lastMessage && typeof raw.lastMessage === 'object') {
    lastMessage = raw.lastMessage.content ?? undefined;
  } else if (typeof raw.lastMessage === 'string') {
    lastMessage = raw.lastMessage || undefined;
  }

  // Property address from nested property object (same fields as adaptProperty)
  let propertyAddress: string | undefined;
  if (raw.property) {
    const p = raw.property;
    propertyAddress =
      [p.addressStreetNumber, p.addressStreetName].filter(Boolean).join(' ') ||
      p.location ||
      undefined;
  }

  return {
    id: raw.id,
    otherUserId: other?.id ?? undefined,
    otherUserName,
    otherUserEmail,
    lastMessage,
    lastMessageAt: raw.lastMessageAt ?? undefined,
    unreadCount: raw.unreadCount ?? undefined,
    propertyId: raw.propertyId ?? undefined,
    propertyAddress,
    subject: undefined,
    buyerUserId: raw.buyerUserId ?? undefined,
    agentUserId: raw.agentUserId ?? undefined,
  };
}

/** Map a raw API message record to the mobile Message type. */
export function adaptMessage(raw: any): Message {
  return {
    id: raw.id,
    content: raw.content ?? '',
    senderUserId: String(raw.senderUserId ?? ''),
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}
