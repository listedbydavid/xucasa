import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  notificationPreferences,
  notifications,
  priceDropNotificationDeliveries,
  properties,
  pushTokens,
  savedProperties,
} from "@workspace/db";
import { trySendNotificationEmail } from "./notificationHelpers";
import { logger } from "../logger";

type PriceDrop = { id: number; oldPrice: number; newPrice: number; eventKey: string };

function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-US")}`;
}

async function sendExpoPush(
  userId: string,
  tokens: string[],
  title: string,
  body: string,
  propertyId: number,
): Promise<void> {
  if (!tokens.length) return;
  for (let index = 0; index < tokens.length; index += 100) {
    const tokenBatch = tokens.slice(index, index + 100);
    const messages = tokenBatch.map(to => ({
      to, sound: "default", channelId: "price-drops", title, body,
      data: { type: "price_drop", propertyId, url: `/property/${propertyId}` },
    }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
    const result = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const tickets = Array.isArray(result.data) ? result.data : [];
    if (tickets.length !== tokenBatch.length) {
      throw new Error("Expo push service returned an incomplete ticket batch");
    }
    const invalidTokens = tokenBatch.filter((_, ticketIndex) =>
      tickets[ticketIndex]?.details?.error === "DeviceNotRegistered"
    );
    if (invalidTokens.length) {
      await Promise.all(invalidTokens.map(token =>
        db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
      ));
    }
    const ticketError = tickets.find(ticket =>
      ticket.status === "error" && ticket.details?.error !== "DeviceNotRegistered"
    );
    if (ticketError) {
      throw new Error(`Expo push ticket failed: ${ticketError.details?.error ?? "unknown error"}`);
    }
  }
}

const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;
let dispatcherRunning = false;
let dispatcherStarted = false;

async function processDelivery(deliveryId: number): Promise<void> {
  const now = new Date();
  const [delivery] = await db.update(priceDropNotificationDeliveries)
    .set({
      lockedUntil: new Date(now.getTime() + DELIVERY_LEASE_MS),
      attempts: sql`${priceDropNotificationDeliveries.attempts} + 1`,
    })
    .where(and(
      eq(priceDropNotificationDeliveries.id, deliveryId),
      isNull(priceDropNotificationDeliveries.deliveredAt),
      lte(priceDropNotificationDeliveries.nextAttemptAt, now),
      or(
        isNull(priceDropNotificationDeliveries.lockedUntil),
        lte(priceDropNotificationDeliveries.lockedUntil, now),
      ),
    ))
    .returning();
  if (!delivery) return;

  try {
    const [property] = await db.select().from(properties)
      .where(eq(properties.id, delivery.propertyId))
      .limit(1);
    if (!property) {
      await db.update(priceDropNotificationDeliveries).set({
        inAppDelivered: true,
        emailDelivered: true,
        pushDelivered: true,
        deliveredAt: new Date(),
        lockedUntil: null,
        lastError: null,
      }).where(eq(priceDropNotificationDeliveries.id, delivery.id));
      return;
    }

    const [preferences] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, delivery.userId))
      .limit(1);
    const title = "Price reduced on a saved home";
    const address = [property.addressStreetNumber, property.addressStreetName]
      .filter(Boolean).join(" ") || property.title;
    const message = `${address} dropped from ${formatPrice(delivery.oldPrice)} to ${formatPrice(delivery.newPrice)}.`;
    const metadata = {
      oldPrice: delivery.oldPrice,
      newPrice: delivery.newPrice,
      priceDropDeliveryId: delivery.id,
    };

    if (!delivery.inAppDelivered) {
      if (preferences?.inAppEnabled !== false && preferences?.inAppPriceDrop !== false) {
        const [existingNotification] = await db.select({ id: notifications.id }).from(notifications)
          .where(and(
            eq(notifications.userId, delivery.userId),
            eq(notifications.type, "price_drop"),
            sql`${notifications.metadata}->>'priceDropDeliveryId' = ${String(delivery.id)}`,
          ))
          .limit(1);
        if (!existingNotification) {
          await db.insert(notifications).values({
            userId: delivery.userId,
            type: "price_drop",
            title,
            message,
            propertyId: delivery.propertyId,
            linkUrl: `/property/${delivery.propertyId}`,
            read: false,
            archived: false,
            metadata,
          });
        }
      }
      await db.update(priceDropNotificationDeliveries)
        .set({ inAppDelivered: true })
        .where(eq(priceDropNotificationDeliveries.id, delivery.id));
      delivery.inAppDelivered = true;
    }

    if (!delivery.emailDelivered) {
      const emailResult = await trySendNotificationEmail(
        delivery.userId,
        "price_drop",
        title,
        message,
        `/property/${delivery.propertyId}`,
        delivery.propertyId,
      );
      if (emailResult.status === "failed") {
        throw new Error(`Email delivery failed: ${emailResult.reason ?? "unknown error"}`);
      }
      await db.update(priceDropNotificationDeliveries)
        .set({ emailDelivered: true })
        .where(eq(priceDropNotificationDeliveries.id, delivery.id));
      delivery.emailDelivered = true;
    }

    if (!delivery.pushDelivered) {
      if (preferences?.pushEnabled !== false && preferences?.pushPriceDrop !== false) {
        const tokens = await db.select({ token: pushTokens.token }).from(pushTokens)
          .where(eq(pushTokens.userId, delivery.userId));
        await sendExpoPush(
          delivery.userId,
          tokens.map(row => row.token),
          title,
          message,
          delivery.propertyId,
        );
      }
      await db.update(priceDropNotificationDeliveries)
        .set({ pushDelivered: true })
        .where(eq(priceDropNotificationDeliveries.id, delivery.id));
      delivery.pushDelivered = true;
    }

    await db.update(priceDropNotificationDeliveries).set({
      deliveredAt: new Date(),
      lockedUntil: null,
      lastError: null,
    }).where(eq(priceDropNotificationDeliveries.id, delivery.id));
  } catch (error) {
    const retryDelay = Math.min(MAX_RETRY_DELAY_MS, 30_000 * 2 ** Math.min(delivery.attempts, 6));
    await db.update(priceDropNotificationDeliveries).set({
      lockedUntil: null,
      nextAttemptAt: new Date(Date.now() + retryDelay),
      lastError: error instanceof Error ? error.message : String(error),
    }).where(eq(priceDropNotificationDeliveries.id, delivery.id));
    logger.error({
      event: "price_drop_notification_delivery_failed",
      error: error instanceof Error ? error.message : String(error),
      userId: delivery.userId,
      propertyId: delivery.propertyId,
      deliveryId: delivery.id,
      retryDelay,
    });
  }
}

async function processPendingDeliveries(): Promise<void> {
  if (dispatcherRunning) return;
  dispatcherRunning = true;
  try {
    const now = new Date();
    const pending = await db.select({ id: priceDropNotificationDeliveries.id })
      .from(priceDropNotificationDeliveries)
      .where(and(
        isNull(priceDropNotificationDeliveries.deliveredAt),
        lte(priceDropNotificationDeliveries.nextAttemptAt, now),
        or(
          isNull(priceDropNotificationDeliveries.lockedUntil),
          lte(priceDropNotificationDeliveries.lockedUntil, now),
        ),
      ))
      .limit(100);
    await Promise.all(pending.map(row => processDelivery(row.id)));
  } catch (error) {
    logger.error({
      event: "price_drop_notification_dispatch_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    dispatcherRunning = false;
  }
}

export function startPriceDropNotificationDispatcher(): void {
  if (dispatcherStarted) return;
  dispatcherStarted = true;
  void processPendingDeliveries();
  const timer = setInterval(() => void processPendingDeliveries(), 30_000);
  timer.unref();
}

export async function notifySavedPropertyPriceDrops(drops: PriceDrop[]): Promise<void> {
  const deliveryIds: number[] = [];
  for (const drop of drops) {
    if (drop.newPrice <= 0 || drop.newPrice >= drop.oldPrice) continue;
    const [property] = await db.select().from(properties).where(eq(properties.id, drop.id)).limit(1);
    if (!property) continue;
    const recipients = await db.selectDistinct({ userId: savedProperties.userId })
      .from(savedProperties)
      .where(and(eq(savedProperties.propertyId, drop.id), eq(savedProperties.priceDropAlerts, true)));

    await Promise.all(recipients.map(async recipient => {
      const [delivery] = await db.insert(priceDropNotificationDeliveries).values({
        userId: recipient.userId,
        propertyId: drop.id,
        oldPrice: drop.oldPrice,
        newPrice: drop.newPrice,
        eventKey: drop.eventKey,
      }).onConflictDoNothing({
        target: [
          priceDropNotificationDeliveries.userId,
          priceDropNotificationDeliveries.propertyId,
          priceDropNotificationDeliveries.eventKey,
        ],
      }).returning({ id: priceDropNotificationDeliveries.id });
      if (delivery) deliveryIds.push(delivery.id);
    }));
  }
  await Promise.all(deliveryIds.map(processDelivery));
}