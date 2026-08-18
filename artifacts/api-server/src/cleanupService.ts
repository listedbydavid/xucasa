import { db } from "./db";
import { users } from "@workspace/db";
import {
  savedProperties,
  favoriteLists,
  buyerProfiles,
  userHomes,
  searchHistory,
  buyerInterest,
  messages,
  conversations,
  properties,
  notificationPreferences,
  clientAgentLinks,
  savedSearches,
  buyerMatches,
  sellerPitches,
  propertyOffers,
  swipeNotifications,
  propertyReviews,
  notifications,
  showingRequests,
  agentContacts,
  contactTags,
  contactTagAssignments,
} from "@workspace/db";
import { eq, or, ilike, ne, sql, inArray, isNull } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";

type DrizzleTable = PgTable;
type DrizzleColumn = PgColumn;

const TEST_EMAIL_PATTERNS = [
  "%@test.com",
  "%@example.com",
  "%@example.org",
  "%@example.net",
  "%@mailinator.com",
  "%@tempmail.com",
  "%@throwaway.email",
  "%.test",
  "e2e_%",
  "e2e-%@%",
  "test-%@%",
  "test_%@%",
  "dummy%@%",
  "dummy-%@%",
  "fake%@%",
  "fake-%@%",
];

const TEST_ID_PATTERNS = [
  "test-%",
  "e2e-%",
  "dummy-%",
  "fake-%",
  "seed-%",
];

function logCleanup(action: string, details: Record<string, unknown>) {
  console.log(
    `[Cleanup] action=${action} ${Object.entries(details)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ")} timestamp=${new Date().toISOString()}`
  );
}

async function isProtectedUser(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role, email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return false;
  if (user.role === "admin") return true;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase())
    return true;
  return false;
}

export async function listSuspiciousAccounts() {
  const emailConditions = TEST_EMAIL_PATTERNS.map((pattern) =>
    ilike(users.email, pattern)
  );
  const idConditions = TEST_ID_PATTERNS.map((pattern) =>
    ilike(users.id, pattern)
  );

  const results = await db
    .select()
    .from(users)
    .where(
      or(
        ...emailConditions,
        ...idConditions,
        ne(users.accountSource, "real"),
        isNull(users.accountSource)
      )
    );

  logCleanup("list_suspicious", { count: results.length });
  return results;
}

export async function disableAccount(
  userId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  if (await isProtectedUser(userId)) {
    logCleanup("disable_blocked", { userId, reason: "protected_user" });
    return { success: false, message: "Cannot disable admin or protected user" };
  }

  const [updated] = await db
    .update(users)
    .set({ status: "disabled", adminNotes: reason, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    logCleanup("disable_failed", { userId, reason: "not_found" });
    return { success: false, message: "User not found" };
  }

  logCleanup("disable_success", { userId, reason });
  return { success: true, message: `User ${userId} disabled` };
}

function extractRowCount(result: { rowCount: number } | unknown[] | unknown): number {
  if (result && typeof result === "object" && "rowCount" in result) {
    return Number((result as { rowCount: number }).rowCount);
  }
  return 0;
}

export async function deleteAccountSafely(
  userId: string,
  options: { confirm: boolean }
): Promise<{ success: boolean; message: string; summary?: Record<string, number> }> {
  if (!options.confirm) {
    return {
      success: false,
      message: "Deletion requires explicit confirm: true flag",
    };
  }

  if (await isProtectedUser(userId)) {
    logCleanup("delete_blocked", { userId, reason: "protected_user" });
    return { success: false, message: "Cannot delete admin or protected user" };
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  const summary: Record<string, number> = {};

  logCleanup("delete_start", { userId, email: targetUser.email });

  try {
    await db.transaction(async (tx) => {
      function deleteAndTrack(
        table: DrizzleTable,
        column: DrizzleColumn,
        tableName: string
      ) {
        return tx.delete(table).where(eq(column, userId)).then((result) => {
          const count = extractRowCount(result);
          summary[tableName] = (summary[tableName] || 0) + count;
          if (count > 0) {
            logCleanup("delete_related", { userId, table: tableName, count });
          }
        });
      }

      const userBuyerProfiles = await tx
        .select({ id: buyerProfiles.id })
        .from(buyerProfiles)
        .where(eq(buyerProfiles.userId, userId));
      const profileIds = userBuyerProfiles.map((p) => p.id);

      if (profileIds.length > 0) {
        const bmResult = await tx
          .delete(buyerMatches)
          .where(inArray(buyerMatches.buyerProfileId, profileIds));
        summary["buyer_matches_by_profile"] = extractRowCount(bmResult);

        await tx
          .update(propertyOffers)
          .set({ buyerProfileId: null })
          .where(inArray(propertyOffers.buyerProfileId, profileIds));
      }

      await deleteAndTrack(buyerMatches, buyerMatches.senderId, "buyer_matches_by_sender");

      const userProps = await tx
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.agentId, userId));
      const propIds = userProps.map((p) => p.id);

      if (propIds.length > 0) {
        const bmPropResult = await tx
          .delete(buyerMatches)
          .where(inArray(buyerMatches.propertyId, propIds));
        summary["buyer_matches_by_property"] = extractRowCount(bmPropResult);

        const spResult = await tx
          .delete(savedProperties)
          .where(inArray(savedProperties.propertyId, propIds));
        summary["saved_properties_by_property"] = extractRowCount(spResult);

        const prResult = await tx
          .delete(propertyReviews)
          .where(inArray(propertyReviews.propertyId, propIds));
        summary["property_reviews_by_property"] = extractRowCount(prResult);

        const poResult = await tx
          .delete(propertyOffers)
          .where(inArray(propertyOffers.propertyId, propIds));
        summary["property_offers_by_property"] = extractRowCount(poResult);

        const snResult = await tx
          .delete(swipeNotifications)
          .where(inArray(swipeNotifications.propertyId, propIds));
        summary["swipe_notifications_by_property"] = extractRowCount(snResult);

        const biResult = await tx
          .delete(buyerInterest)
          .where(inArray(buyerInterest.propertyId, propIds));
        summary["buyer_interest_by_property"] = extractRowCount(biResult);

        const propConvs = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(inArray(conversations.propertyId, propIds));
        const propConvIds = propConvs.map((c) => c.id);
        if (propConvIds.length > 0) {
          await tx.delete(messages).where(inArray(messages.conversationId, propConvIds));
          await tx.delete(showingRequests).where(inArray(showingRequests.conversationId, propConvIds));
          await tx.delete(conversations).where(inArray(conversations.id, propConvIds));
        }
      }

      await deleteAndTrack(swipeNotifications, swipeNotifications.buyerUserId, "swipe_notifications");
      await deleteAndTrack(swipeNotifications, swipeNotifications.notifiedUserId, "swipe_notifications_notified");

      await deleteAndTrack(propertyOffers, propertyOffers.buyerUserId, "property_offers_buyer");
      await tx.update(propertyOffers).set({ sellerUserId: null }).where(eq(propertyOffers.sellerUserId, userId));
      await tx.update(propertyOffers).set({ listingAgentId: null }).where(eq(propertyOffers.listingAgentId, userId));
      await tx.update(propertyOffers).set({ buyerAgentId: null }).where(eq(propertyOffers.buyerAgentId, userId));

      await deleteAndTrack(savedProperties, savedProperties.userId, "saved_properties");

      await deleteAndTrack(propertyReviews, propertyReviews.userId, "property_reviews");

      const userConversations = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          or(
            eq(conversations.buyerUserId, userId),
            eq(conversations.agentUserId, userId),
            eq(conversations.relatedBuyerUserId, userId)
          )
        );
      const convIds = userConversations.map((c) => c.id);

      if (convIds.length > 0) {
        await tx
          .update(buyerInterest)
          .set({ conversationId: null, buyerConversationId: null, agentCoordinationConversationId: null })
          .where(
            or(
              inArray(buyerInterest.conversationId, convIds),
              inArray(buyerInterest.buyerConversationId, convIds),
              inArray(buyerInterest.agentCoordinationConversationId, convIds)
            )
          );

        await tx
          .update(buyerMatches)
          .set({ conversationId: null })
          .where(inArray(buyerMatches.conversationId, convIds));

        const msgResult = await tx
          .delete(messages)
          .where(inArray(messages.conversationId, convIds));
        summary["messages"] = extractRowCount(msgResult);

        const srResult = await tx
          .delete(showingRequests)
          .where(inArray(showingRequests.conversationId, convIds));
        summary["showing_requests"] = extractRowCount(srResult);

        const convResult = await tx
          .delete(conversations)
          .where(inArray(conversations.id, convIds));
        summary["conversations"] = extractRowCount(convResult);
      }

      await deleteAndTrack(showingRequests, showingRequests.buyerUserId, "showing_requests_buyer");
      await deleteAndTrack(showingRequests, showingRequests.agentUserId, "showing_requests_agent");

      await deleteAndTrack(messages, messages.senderUserId, "messages_sent");

      await deleteAndTrack(buyerInterest, buyerInterest.buyerUserId, "buyer_interest");
      await tx.update(buyerInterest).set({ assignedAgentUserId: null }).where(eq(buyerInterest.assignedAgentUserId, userId));
      await tx.update(buyerInterest).set({ listingAgentUserId: null }).where(eq(buyerInterest.listingAgentUserId, userId));

      await deleteAndTrack(favoriteLists, favoriteLists.userId, "favorite_lists");
      await deleteAndTrack(buyerProfiles, buyerProfiles.userId, "buyer_profiles");
      await deleteAndTrack(userHomes, userHomes.userId, "user_homes");
      await deleteAndTrack(searchHistory, searchHistory.userId, "search_history");
      await deleteAndTrack(savedSearches, savedSearches.userId, "saved_searches");
      await deleteAndTrack(sellerPitches, sellerPitches.userId, "seller_pitches");
      await deleteAndTrack(notifications, notifications.userId, "notifications");
      await deleteAndTrack(notificationPreferences, notificationPreferences.userId, "notification_preferences");
      await deleteAndTrack(clientAgentLinks, clientAgentLinks.clientId, "client_agent_links_client");
      await deleteAndTrack(clientAgentLinks, clientAgentLinks.agentId, "client_agent_links_agent");

      const userAgentContacts = await tx
        .select({ id: agentContacts.id })
        .from(agentContacts)
        .where(eq(agentContacts.agentId, userId));
      const contactIds = userAgentContacts.map((c) => c.id);
      if (contactIds.length > 0) {
        await tx.delete(contactTagAssignments).where(inArray(contactTagAssignments.contactId, contactIds));
      }
      await deleteAndTrack(agentContacts, agentContacts.agentId, "agent_contacts");

      const userContactTags = await tx
        .select({ id: contactTags.id })
        .from(contactTags)
        .where(eq(contactTags.agentId, userId));
      const tagIds = userContactTags.map((t) => t.id);
      if (tagIds.length > 0) {
        await tx.delete(contactTagAssignments).where(inArray(contactTagAssignments.tagId, tagIds));
      }
      await deleteAndTrack(contactTags, contactTags.agentId, "contact_tags");

      await tx
        .update(users)
        .set({ assignedAgentUserId: null })
        .where(eq(users.assignedAgentUserId, userId));

      const propResult = await tx
        .delete(properties)
        .where(eq(properties.agentId, userId));
      summary["properties"] = extractRowCount(propResult);

      await tx.delete(users).where(eq(users.id, userId));
      summary["users"] = 1;
    });

    logCleanup("delete_complete", { userId, summary });
    return { success: true, message: `User ${userId} deleted`, summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logCleanup("delete_failed", { userId, error: message });
    return { success: false, message: `Deletion failed: ${message}` };
  }
}

export async function bulkDisable(
  userIds: string[],
  reason: string
): Promise<{ results: { userId: string; success: boolean; message: string }[] }> {
  const results = [];
  for (const userId of userIds) {
    const result = await disableAccount(userId, reason);
    results.push({ userId, ...result });
  }
  logCleanup("bulk_disable", { count: userIds.length, reason });
  return { results };
}

export async function bulkDelete(
  userIds: string[],
  options: { confirm: boolean }
): Promise<{ results: { userId: string; success: boolean; message: string; summary?: Record<string, number> }[] }> {
  if (!options.confirm) {
    return {
      results: userIds.map((userId) => ({
        userId,
        success: false,
        message: "Deletion requires explicit confirm: true flag",
      })),
    };
  }

  const results = [];
  for (const userId of userIds) {
    const result = await deleteAccountSafely(userId, options);
    results.push({ userId, ...result });
  }
  logCleanup("bulk_delete", { count: userIds.length });
  return { results };
}
