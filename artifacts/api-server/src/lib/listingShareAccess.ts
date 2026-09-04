import { createHmac, timingSafeEqual } from "crypto";

type ShareableProperty = {
  id: number;
  agentId?: string | null;
  listingStatus?: string | null;
  status?: string | null;
  isOffMarket?: boolean | null;
};

function getSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

export function isPrivateListing(property: ShareableProperty): boolean {
  const status = (property.listingStatus || property.status || "").toLowerCase();
  return property.isOffMarket === true
    || status === "draft"
    || status === "off_market"
    || status === "pre_market";
}

export function createListingShareToken(property: ShareableProperty): string {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET is required for private listing shares");
  return createHmac("sha256", secret)
    .update(`xucasa-listing-share:${property.id}:${property.agentId || ""}`)
    .digest("base64url");
}

export function verifyListingShareToken(property: ShareableProperty, token: unknown): boolean {
  const secret = getSecret();
  if (!secret || typeof token !== "string" || !token) return false;
  const expected = createListingShareToken(property);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(token);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function hasListingShareAccess(req: any, property: ShareableProperty): boolean {
  const status = (property.listingStatus || property.status || "").toLowerCase();
  const isOwner = !!req.user?.claims?.sub && req.user.claims.sub === property.agentId;

  // Drafts are never share-token or session accessible. Only the exact
  // server-owned listing agent may view them.
  if (status === "draft") return isOwner;
  if (!isPrivateListing(property)) return true;
  if (isOwner) return true;

  const token = req.query?.shareToken;
  if (verifyListingShareToken(property, token)) {
    if (req.session) {
      const granted = new Set<number>(
        Array.isArray(req.session.sharedPropertyIds) ? req.session.sharedPropertyIds : [],
      );
      granted.add(property.id);
      req.session.sharedPropertyIds = Array.from(granted).slice(-50);
    }
    return true;
  }

  return Array.isArray(req.session?.sharedPropertyIds)
    && req.session.sharedPropertyIds.includes(property.id);
}