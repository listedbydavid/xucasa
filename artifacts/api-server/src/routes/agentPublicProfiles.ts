import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { agentPublicProfiles, properties, users } from "@workspace/db";
import { isAuthenticated } from "../replit_integrations/auth/authGuard";
import { audit } from "../auditLog";
import { getRealtyFeedToken, importAgentResoTransactions, REALTYFEED_API_BASE, realtyFeedODataFetch } from "../idxSync";

const router = Router();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
const nullableHttpUrl = z.string().trim().max(2048).url().refine(
  value => safeHttpUrl(value) !== null,
  "Only HTTP and HTTPS URLs are allowed",
).nullable().optional();
export const agentPublicProfileUpdateSchema = z.object({
  bio: nullableText(4000), displayNameOverride: nullableText(200),
  emailOverride: z.string().email().max(320).nullable().optional(),
  phoneOverride: nullableText(50), websiteOverride: nullableHttpUrl,
  profileImageUrlOverride: nullableHttpUrl,
  brokerageNameOverride: nullableText(200), brokerageAddressOverride: nullableText(500),
  brokerageWebsiteOverride: nullableHttpUrl, licenseOverride: nullableText(100), brokerageLicenseOverride: nullableText(100),
  showEmail: z.boolean().optional(), showPhone: z.boolean().optional(), showWebsite: z.boolean().optional(),
  showLicense: z.boolean().optional(), showBrokerageName: z.boolean().optional(),
  showBrokerageAddress: z.boolean().optional(), showBrokerageWebsite: z.boolean().optional(),
  showBrokerageLicense: z.boolean().optional(),
}).strict();

export function isVerifiedAgent(user: any) {
  return !!user && user.role === "agent" && user.agentVerified === true;
}

function accountDisplayName(user: any) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
}
export function resolveAgentPublicProfile(user: any, profile: any) {
  const p = profile || {};
  const value = (key: string, mls: string, account: any) =>
    p[key] != null ? { value: p[key], source: "override" } : p[mls] != null ? { value: p[mls], source: "mls" } : { value: account ?? null, source: "account" };
  return {
    displayName: value("displayNameOverride", "mlsDisplayName", accountDisplayName(user)),
    email: value("emailOverride", "mlsEmail", user.email),
    phone: value("phoneOverride", "mlsPhone", user.phone),
    website: value("websiteOverride", "mlsWebsite", null),
    profileImageUrl: value("profileImageUrlOverride", "mlsProfileImageUrl", user.profileImageUrl),
    brokerageName: value("brokerageNameOverride", "mlsBrokerageName", user.brokerageName),
    brokerageAddress: value("brokerageAddressOverride", "mlsBrokerageAddress", user.mailingAddress),
    brokerageWebsite: value("brokerageWebsiteOverride", "mlsBrokerageWebsite", null),
    license: value("licenseOverride", "mlsLicense", user.licenseNumber),
    brokerageLicense: value("brokerageLicenseOverride", "mlsBrokerageLicense", null),
  };
}
export function publicAgentProfile(user: any, profile: any) {
  const r = resolveAgentPublicProfile(user, profile);
  const visible = (name: keyof typeof r, flag: string) => profile?.[flag] === false ? null : r[name].value;
  return {
    id: user.id, displayName: r.displayName.value, profileImageUrl: safeHttpUrl(r.profileImageUrl.value),
    email: visible("email", "showEmail"), phone: visible("phone", "showPhone"), website: safeHttpUrl(visible("website", "showWebsite")),
    brokerageName: visible("brokerageName", "showBrokerageName"), brokerageAddress: visible("brokerageAddress", "showBrokerageAddress"),
    brokerageWebsite: safeHttpUrl(visible("brokerageWebsite", "showBrokerageWebsite")), licenseNumber: visible("license", "showLicense"),
    brokerageLicense: visible("brokerageLicense", "showBrokerageLicense"),
    licenseState: profile?.showLicense === false ? null : user.licenseState ?? null,
    bio: profile?.bio ?? null,
    sourceFields: Object.fromEntries(Object.entries(r).map(([key, x]: any) => [key, x.source])),
    lastMlsSyncAt: profile?.lastMlsSyncAt ?? null,
  };
}
export function propertyAttributedToAgent(property: any, user: any) {
  return property.agentId === user.id ||
    (!!user.agentMlsId && property.listingAgentMlsId === user.agentMlsId) ||
    (!!user.licenseNumber && property.listingAgentLicenseNumber === user.licenseNumber);
}
function propertySummary(p: any) {
  return { id: p.id, title: p.title, location: p.location, addressCity: p.addressCity, addressState: p.addressState,
    price: p.price, closePrice: p.closePrice, listDate: p.listDate, closeDate: p.closeDate, beds: p.beds,
    baths: p.baths, sqft: p.sqft, imageUrl: p.imageUrl, listingStatus: p.listingStatus, status: p.status, source: p.source, mlsNumber: p.mlsNumber };
}
function saleDate(p: any) { return p.closeDate || p.listDate || p.idxUpdatedAt || p.createdAt; }
export function groupAgentProperties(rows: any[], user: any, now = new Date()) {
  const privateLifecycle = (p: any) => [p.status, p.listingStatus].some(s => ["archived", "off_market", "pre_market", "private", "removed"].includes(s));
  const attributed = rows.filter(p => propertyAttributedToAgent(p, user) && !p.archivedAt && !p.isOffMarket && !privateLifecycle(p));
  const currentListings = attributed.filter(p => ["active", "coming_soon", "pending"].includes(p.status) || ["active", "coming_soon", "pending"].includes(p.listingStatus));
  const sold = attributed.filter(p => p.status === "sold" || p.listingStatus === "sold");
  const year = now.getUTCFullYear(), start = new Date(Date.UTC(year, 0, 1)), previous = new Date(Date.UTC(year - 1, 0, 1)), five = new Date(Date.UTC(year - 4, 0, 1));
  const inPeriod = (p: any, from: Date, until?: Date) => { const d = saleDate(p); return d && d >= from && (!until || d < until); };
  const descending = (date: (p: any) => Date | null | undefined) => (a: any, b: any) => (date(b)?.getTime() || 0) - (date(a)?.getTime() || 0);
  return { currentListings: currentListings.sort(descending(p => p.listDate)), salesYtd: sold.filter(p => inPeriod(p, start)).sort(descending(saleDate)), salesPreviousYear: sold.filter(p => inPeriod(p, previous, start)).sort(descending(saleDate)), salesFiveYears: sold.filter(p => inPeriod(p, five)).sort(descending(saleDate)), periods: { currentYear: year, previousYear: year - 1, fiveYearStart: year - 4 } };
}
async function currentUser(req: any, res: any, verified = true) {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.user.claims.sub) });
  if (!user || user.role !== "agent" || (verified && !isVerifiedAgent(user))) {
    res.status(403).json({ message: verified ? "Verified agent access required" : "Agent access required" });
    return null;
  }
  return user;
}
async function getProfile(userId: string) {
  return db.query.agentPublicProfiles.findFirst({ where: eq(agentPublicProfiles.userId, userId) });
}

router.get("/api/agents/directory", isAuthenticated, async (req: any, res) => {
  const viewer = await currentUser(req, res); if (!viewer) return;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100), offset = Math.max(Number(req.query.offset) || 0, 0);
  const q = String(req.query.q || "").trim().toLowerCase();
  const rows = await db.select().from(users).where(and(eq(users.role, "agent"), eq(users.agentVerified, true)));
  const profiles = await db.select().from(agentPublicProfiles);
  const profileByUserId = new Map(profiles.map(profile => [profile.userId, profile]));
  const selected = rows
    .map(user => ({ user, profile: profileByUserId.get(user.id) }))
    .filter(({ user, profile }) => {
      if (!q) return true;
      const publicValues = publicAgentProfile(user, profile);
      return [
        publicValues.displayName,
        publicValues.brokerageName,
        publicValues.licenseNumber,
        user.licenseState,
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  const allProperties = await db.select().from(properties);
  const agents = selected.slice(offset, offset + limit).map(({ user, profile }) => {
    const grouped = groupAgentProperties(allProperties, user);
    return {
      ...publicAgentProfile(user, profile),
      currentListingsCount: grouped.currentListings.length,
      salesYtdCount: grouped.salesYtd.length,
      salesPreviousYearCount: grouped.salesPreviousYear.length,
      salesFiveYearsCount: grouped.salesFiveYears.length,
    };
  });
  res.json({ agents, total: selected.length, limit, offset });
});
router.get("/api/agents/:agentId/profile", isAuthenticated, async (req: any, res) => {
  const viewer = await currentUser(req, res); if (!viewer) return;
  const user = await db.query.users.findFirst({ where: and(eq(users.id, req.params.agentId), eq(users.role, "agent"), eq(users.agentVerified, true)) });
  if (!user) return res.status(404).json({ message: "Verified agent not found" });
  const profile = await getProfile(user.id); const grouped = groupAgentProperties(await db.select().from(properties), user);
  res.json({ ...publicAgentProfile(user, profile), periods: grouped.periods, currentListings: grouped.currentListings.map(propertySummary), salesYtd: grouped.salesYtd.map(propertySummary), salesPreviousYear: grouped.salesPreviousYear.map(propertySummary), salesFiveYears: grouped.salesFiveYears.map(propertySummary) });
});
router.get("/api/agent/public-profile", isAuthenticated, async (req: any, res) => {
  const user = await currentUser(req, res, false); if (!user) return;
  const profile = await getProfile(user.id);
  res.json({ ...(profile || { userId: user.id }), resolvedPreview: publicAgentProfile(user, profile) });
});
router.patch("/api/agent/public-profile", isAuthenticated, async (req: any, res) => {
  const user = await currentUser(req, res); if (!user) return;
  const parsed = agentPublicProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) { await audit({ req, event: "agent_public_profile_updated", outcome: "failure", userId: user.id, errorMessage: "Invalid profile update" }); return res.status(400).json({ message: "Invalid profile update", errors: parsed.error.flatten() }); }
  try {
    await db.insert(agentPublicProfiles).values({ userId: user.id, ...parsed.data, updatedAt: new Date() }).onConflictDoUpdate({ target: agentPublicProfiles.userId, set: { ...parsed.data, updatedAt: new Date() } });
    const profile = await getProfile(user.id); await audit({ req, event: "agent_public_profile_updated", outcome: "success", userId: user.id });
    res.json({ ...profile, resolvedPreview: publicAgentProfile(user, profile) });
  } catch (error: any) { await audit({ req, event: "agent_public_profile_updated", outcome: "failure", userId: user.id, errorMessage: error.message }); res.status(500).json({ message: "Failed to update public profile" }); }
});
router.post("/api/agent/public-profile/sync-mls", isAuthenticated, async (req: any, res) => {
  const user = await currentUser(req, res); if (!user) return;
  try {
    const filter = user.agentMlsId ? `MemberKey eq '${user.agentMlsId.replace(/'/g, "''")}'` : `MemberStateLicense eq '${(user.licenseNumber || "").replace(/'/g, "''")}'`;
    if (!user.agentMlsId && !user.licenseNumber) return res.status(400).json({ message: "An MLS ID or license number is required" });
    const token = await getRealtyFeedToken();
    const safeSelect = "MemberKey,MemberFullName,MemberEmail,MemberDirectPhone,MemberStateLicense,OfficeName,OfficeKey";
    const extendedSelect = `${safeSelect},MemberHomePageURL,MemberPhotoURL,MemberMobilePhone,MemberOfficePhone`;
    const memberUrl = (select: string) => `${REALTYFEED_API_BASE}/Member?$filter=${encodeURIComponent(filter)}&$top=1&$select=${select}`;
    let response = await realtyFeedODataFetch(memberUrl(extendedSelect), token);
    if (!response.ok) response = await realtyFeedODataFetch(memberUrl(safeSelect), token);
    if (!response.ok) throw new Error(`MLS member lookup failed (${response.status})`);
    const member = ((await response.json()) as any).value?.[0];
    if (!member) return res.status(404).json({ message: "MLS member not found" });
    let office: any = null;
    if (member.OfficeKey) {
      const officeFilter = encodeURIComponent(`OfficeKey eq '${String(member.OfficeKey).replace(/'/g, "''")}'`);
      const officeSafe = "OfficeName,OfficeBrokerMlsId";
      const officeExtended = `${officeSafe},OfficeAddress1,OfficeCity,OfficeStateOrProvince,OfficePostalCode,OfficeURL,OfficeLicense`;
      let officeResponse = await realtyFeedODataFetch(`${REALTYFEED_API_BASE}/Office?$filter=${officeFilter}&$top=1&$select=${officeExtended}`, token);
      if (!officeResponse.ok) officeResponse = await realtyFeedODataFetch(`${REALTYFEED_API_BASE}/Office?$filter=${officeFilter}&$top=1&$select=${officeSafe}`, token);
      if (officeResponse.ok) office = ((await officeResponse.json()) as any).value?.[0] || null;
    }
    if (!user.agentMlsId && member.MemberKey) await db.update(users).set({ agentMlsId: String(member.MemberKey), updatedAt: new Date() }).where(eq(users.id, user.id));
    const agentMlsId = user.agentMlsId || member.MemberKey || null;
    const snapshot = { mlsDisplayName: member.MemberFullName || null, mlsEmail: member.MemberEmail || null, mlsPhone: member.MemberDirectPhone || member.MemberMobilePhone || member.MemberOfficePhone || null, mlsWebsite: safeHttpUrl(member.MemberHomePageURL), mlsProfileImageUrl: safeHttpUrl(member.MemberPhotoURL), mlsLicense: member.MemberStateLicense || null, mlsBrokerageName: office?.OfficeName || member.OfficeName || null, mlsBrokerageAddress: office ? [office.OfficeAddress1, office.OfficeCity, office.OfficeStateOrProvince, office.OfficePostalCode].filter(Boolean).join(", ") || null : null, mlsBrokerageWebsite: safeHttpUrl(office?.OfficeURL), mlsBrokerageLicense: office?.OfficeLicense || office?.OfficeBrokerMlsId || null, lastMlsSyncAt: new Date(), updatedAt: new Date() };
    await db.insert(agentPublicProfiles).values({ userId: user.id, ...snapshot }).onConflictDoUpdate({ target: agentPublicProfiles.userId, set: snapshot });
    const importedCount = agentMlsId ? await importAgentResoTransactions(String(agentMlsId)) : 0;
    const profile = await getProfile(user.id);
    await audit({ req, event: "agent_public_profile_mls_synced", outcome: "success", userId: user.id });
    res.json({ ...profile, resolvedPreview: publicAgentProfile({ ...user, agentMlsId }, profile), importedCount });
  } catch (error: any) { await audit({ req, event: "agent_public_profile_mls_synced", outcome: "failure", userId: user.id, errorMessage: error.message }); res.status(502).json({ message: "Unable to sync MLS profile" }); }
});
export default router;