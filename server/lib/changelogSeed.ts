import { db } from "../db";
import { featureChangelog } from "@shared/schema";
import { sql } from "drizzle-orm";

export const XUCASA_CHANGELOG = [
  {
    version: "1.0.0",
    title: "Xucasa launches in San Diego",
    description: "Search, swipe, and connect with agents — all without your information being sold to the highest bidder.",
    category: "launch",
  },
  {
    version: "1.1.0",
    title: "Seller Terms — Make Me Move",
    description: "Sellers and agents can now post concessions directly on listings: closing cost contributions, assumable loans, rate buydowns, and flexible move-out timelines.",
    category: "feature",
  },
  {
    version: "1.2.0",
    title: "Beacon buyer matching",
    description: "Agents can now enter an upcoming listing address and see how many active buyers match — before the home even hits the market. Use it in your listing presentations.",
    category: "feature",
  },
  {
    version: "1.3.0",
    title: "Guest swipe — no account required",
    description: "Visitors can now browse and swipe homes without creating an account. Sign up when you're ready to save homes and connect with an agent.",
    category: "improvement",
  },
];

export async function seedChangelog(): Promise<void> {
  for (const entry of XUCASA_CHANGELOG) {
    await db.insert(featureChangelog)
      .values({
        version: entry.version,
        title: entry.title,
        description: entry.description,
        category: entry.category,
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: featureChangelog.version,
        set: {
          title: entry.title,
          description: entry.description,
          category: entry.category,
        },
      });
  }
}
