import { storage } from "../storage";
import { sendNotificationEmail, isEmailConfigured } from "../emailService";

export const FAIR_HOUSING_PROHIBITED = [
  "no kids", "no children", "no families", "adults only", "no section 8",
  "christian", "muslim", "jewish", "hindu", "buddhist", "catholic",
  "whites only", "no blacks", "no hispanics", "no asians", "no mexicans",
  "english only", "american only", "no immigrants", "no foreigners",
  "no disabled", "no wheelchair", "no handicap", "able-bodied only",
  "no gay", "no lgbtq", "straight only", "no trans",
  "no single mothers", "no single parents", "married only", "couples only",
  "no elderly", "young only", "no seniors",
];

export function checkFairHousing(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FAIR_HOUSING_PROHIBITED) {
    if (lower.includes(term)) {
      return `Content contains language ("${term}") that may violate the Fair Housing Act. Please describe only property features.`;
    }
  }
  return null;
}

export type NotificationEmailResult = {
  status: "sent" | "skipped" | "failed";
  reason?: string;
};

export async function trySendNotificationEmail(
  targetUserId: string,
  type: string,
  title: string,
  message: string,
  linkUrl?: string | null,
  propertyId?: number | null,
  conversationId?: number | null,
): Promise<NotificationEmailResult> {
  try {
    const configured = await isEmailConfigured();
    if (!configured) return { status: "skipped", reason: "Email is not configured" };
    let prefs = await storage.getNotificationPreferences(targetUserId);
    if (!prefs) {
      prefs = await storage.upsertNotificationPreferences(targetUserId, {});
    }
    if (!prefs.emailEnabled) return { status: "skipped", reason: "Email notifications are disabled" };

    const typeToField: Record<string, keyof typeof prefs> = {
      new_listing: "emailNewListing",
      price_drop: "emailPriceDrop",
      open_house: "emailOpenHouse",
      agent_match: "emailAgentMatch",
      system: "emailSystem",
      message_received: "emailSystem",
      showing_request: "emailSystem",
      showing_confirmed: "emailSystem",
      showing_declined: "emailSystem",
      showing_update: "emailSystem",
      offer_response: "emailSystem",
    };
    const field = typeToField[type];
    if (!field) return { status: "skipped", reason: "Notification type is not email-enabled" };
    if (!prefs[field]) return { status: "skipped", reason: "This email category is disabled" };

    const today = new Date().toISOString().split("T")[0];
    const emailsToday = prefs.lastEmailResetDate === today ? prefs.emailsSentToday : 0;

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser?.email) return { status: "skipped", reason: "Recipient has no email address" };

    let propertyCard = null;
    if (propertyId && (type === "new_listing" || type === "price_drop" || type === "open_house")) {
      try {
        const property = await storage.getProperty(propertyId);
        if (property) {
          const formatPrice = (p: number) => p >= 1000000 ? `$${(p / 1000000).toFixed(1)}M` : p >= 1000 ? `$${Math.round(p / 1000)}K` : `$${p}`;
          propertyCard = {
            address: property.title || `${property.addressStreetNumber || ""} ${property.addressStreetName || ""}`.trim(),
            price: formatPrice(property.price),
            beds: property.beds || undefined,
            baths: property.baths || undefined,
            sqft: property.sqft || undefined,
            imageUrl: property.imageUrl || null,
            propertyType: property.propertyType || undefined,
          };
        }
      } catch { }
    }

    const result = await sendNotificationEmail({
      to: targetUser.email,
      recipientName: targetUser.firstName || targetUser.email,
      type, title, message, linkUrl: linkUrl ?? undefined,
      propertyId: propertyId ?? null,
      conversationId: conversationId ?? null,
      propertyCard,
      digestFrequency: prefs.emailDigestFrequency,
      emailsSentToday: emailsToday,
    } as any);

    if (result.sent) {
      await storage.incrementEmailCount(targetUserId);
      return { status: "sent" };
    }
    const reason = result.reason ?? "Email provider rejected the message";
    if (
      reason.includes("Duplicate email suppressed") ||
      reason.includes("Daily limit reached") ||
      reason.includes("not connected")
    ) {
      return { status: "skipped", reason };
    }
    return { status: "failed", reason };
  } catch (err) {
    console.error("[Email] Background email send failed:", err);
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}
