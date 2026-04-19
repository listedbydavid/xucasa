import { Router } from "express";
  import fs from "fs";
  import path from "path";
  import { storage, buyerProfileCompleteness, resolveBuyerAgent } from "../storage";
  import { resolveUserDestination } from "@shared/routing";
  import { authStorage } from "../replit_integrations/auth/storage";
  import { db } from "../db";
  import { buyerMatches, buyerProfiles, sellLeads, users, savedProperties, savedSearches, searchHistory, userHomes, favoriteLists, sellerPitches, properties, clientAgentLinks, propertyOffers, swipeNotifications, propertyReviews, errorReports, notifications, buyerInterest, sellerConcessions, insertSellerConcessionSchema } from "@shared/schema";
  import { eq, desc, sql, or, and, ilike, inArray, count } from "drizzle-orm";
  import { api } from "@shared/routes";
  import { z } from "zod";
  import { isAuthenticated } from "../replit_integrations/auth";
  import { getPublicRecords } from "../publicRecords";
  import { getNearbySchools } from "../schoolService";
  import { getZoningData } from "../zoningData";
  import { runIdxSync, isSyncInProgress, idxConfigured, getLastSyncLog, getSyncLogs, startIdxAutoSync, backfillRentalReclassification, verifyAgentLicense, getRealtyFeedToken, realtyFeedODataFetch, REALTYFEED_API_BASE } from "../idxSync";
  import { sendNotificationEmail, sendTestEmail, isEmailConfigured } from "../emailService";
  import { onboardingRateLimit, isAdmin } from "../authMiddleware";
  import { listSuspiciousAccounts, disableAccount, deleteAccountSafely, bulkDisable, bulkDelete } from "../cleanupService";
  import { audit, executeWithAudit } from "../auditLog";
  import { logger } from "../logger";
  import { stripConfidentialFields, CONFIDENTIAL_MLS_FIELDS } from "../lib/mlsHelpers";
  import { runAgentVerificationFlow } from "../lib/agentVerification";

  const ERROR_ARCHIVE_PATH = path.join(process.cwd(), "data", "error-archive.json");
  
const router = Router();

router.get("/api/properties/:id/reviews", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
    const reviews = await storage.getPropertyReviews(propertyId);
    const publicReviews = reviews
      .filter(r => r.isPublic)
      .map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        isPublic: r.isPublic,
        user: r.user ? {
          firstName: r.user.firstName || "Anonymous",
          lastInitial: r.user.lastName ? r.user.lastName.charAt(0) + "." : "",
          profileImageUrl: r.user.profileImageUrl,
        } : { firstName: "Anonymous", lastInitial: "", profileImageUrl: null },
      }));
    res.json(publicReviews);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/api/properties/:id/reviews/all", isAuthenticated, async (req: any, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.email === process.env.ADMIN_EMAIL;
    const isAgent = user?.role === "agent";

    if (!isAdmin && !isAgent) {
      return res.status(403).json({ message: "Agents and admin only" });
    }

    const prop = await storage.getProperty(propertyId);
    if (!prop) return res.status(404).json({ message: "Property not found" });

    if (!isAdmin && prop.agentId !== userId) {
      return res.status(403).json({ message: "Only the listing agent or admin can view all reviews" });
    }

    const reviews = await storage.getPropertyReviews(propertyId);
    res.json(reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      isPublic: r.isPublic,
      moderatedBy: r.moderatedBy,
      userId: r.userId,
      user: r.user ? {
        firstName: r.user.firstName || "Anonymous",
        lastInitial: r.user.lastName ? r.user.lastName.charAt(0) + "." : "",
        profileImageUrl: r.user.profileImageUrl,
      } : { firstName: "Anonymous", lastInitial: "", profileImageUrl: null },
    })));
  } catch (err) {
    console.error("Error fetching all reviews for property", req.params.id, err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/api/properties/:id/reviews", isAuthenticated, async (req: any, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
    const userId = req.user.claims.sub;

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const missing: string[] = [];
    if (!user.profileImageUrl) missing.push("photo");
    if (!user.emailVerified) missing.push("emailVerified");
    if (!user.phone) missing.push("phone");
    if (!user.mailingAddress) missing.push("mailingAddress");
    if (missing.length > 0) {
      return res.status(403).json({ message: "Complete your profile to leave a review", missing });
    }

    const existing = await storage.getUserReviewForProperty(userId, propertyId);
    if (existing) {
      return res.status(409).json({ message: "You have already reviewed this property" });
    }

    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    if (!comment || typeof comment !== "string" || comment.length > 300) {
      return res.status(400).json({ message: "Comment is required and must be 300 characters or less" });
    }

    const prop = await storage.getProperty(propertyId);
    if (!prop) return res.status(404).json({ message: "Property not found" });

    const review = await storage.createPropertyReview({
      propertyId,
      userId,
      rating,
      comment: comment.trim(),
      isPublic: true,
    });
    await audit({ req, event: "review_created", outcome: "success", userId, propertyId, metadata: { rating } });
    res.status(201).json(review);
  } catch (err: any) {
    await audit({ req, event: "review_created", outcome: "failure", userId: req.user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/api/reviews/:id/visibility", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.email === process.env.ADMIN_EMAIL;

    const [review] = await db.select().from(propertyReviews).where(eq(propertyReviews.id, id));
    if (!review) return res.status(404).json({ message: "Review not found" });

    const [property] = await db.select().from(properties).where(eq(properties.id, review.propertyId));
    const isListingAgent = property && property.agentId === userId;

    if (!isAdmin && !isListingAgent) {
      return res.status(403).json({ message: "Only the listing agent or admin can moderate reviews" });
    }
    const { isPublic } = req.body;
    if (typeof isPublic !== "boolean") {
      return res.status(400).json({ message: "isPublic must be a boolean" });
    }
    const updated = await storage.updateReviewVisibility(id, isPublic, userId);
    await audit({ req, event: "review_visibility_changed", outcome: "success", userId, metadata: { reviewId: id, isPublic } });
    res.json(updated);
  } catch (err: any) {
    await audit({ req, event: "review_visibility_changed", outcome: "failure", userId: req.user?.claims?.sub, errorMessage: err.message });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/api/reviews/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.email === process.env.ADMIN_EMAIL;

    const reviews = await db.select().from(propertyReviews).where(eq(propertyReviews.id, id));
    const review = reviews[0];
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.userId !== userId && !isAdmin) {
      const prop = await storage.getProperty(review.propertyId);
      if (!prop || prop.agentId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this review" });
      }
    }

    await storage.deletePropertyReview(id);
    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
