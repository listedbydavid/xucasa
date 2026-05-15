import { Router } from "express";
import { db } from "../db";
import { tourProgress, tourStepOverrides, pageTipsDismissed, featureChangelog, changelogViews } from "@shared/schema";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "../authMiddleware";
import { executeWithAudit, audit } from "../auditLog";

const router = Router();

router.get("/api/tours/progress/:pageKey", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const pageKey = String(req.params.pageKey);

    const globalRow = await db.select().from(tourProgress)
      .where(and(eq(tourProgress.userId, userId), eq(tourProgress.pageKey, "__global__")))
      .limit(1);
    const globalSkip = globalRow.length > 0 && globalRow[0].globalSkip;

    const rows = await db.select().from(tourProgress)
      .where(and(eq(tourProgress.userId, userId), eq(tourProgress.pageKey, pageKey)))
      .limit(1);
    const progress = rows[0] || null;

    res.json({ progress, globalSkip });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/tours/progress/:pageKey", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const pageKey = String(req.params.pageKey);
  const { currentStep, completed, skipped } = req.body || {};

  try {
    const result = await executeWithAudit<any>(
      { req, event: "tour_progress_updated", userId, resourceType: "tour_progress", resourceId: pageKey, critical: false },
      async () => {
        const values = {
          userId,
          pageKey,
          currentStep: typeof currentStep === "number" ? currentStep : 0,
          completed: !!completed,
          skipped: !!skipped,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        };
        const [row] = await db.insert(tourProgress)
          .values(values)
          .onConflictDoUpdate({
            target: [tourProgress.userId, tourProgress.pageKey],
            set: {
              currentStep: values.currentStep,
              completed: values.completed,
              skipped: values.skipped,
              lastSeenAt: values.lastSeenAt,
              updatedAt: values.updatedAt,
            },
          })
          .returning();
        return { data: row, auditOverrides: { metadata: { pageKey, currentStep: values.currentStep, completed: values.completed, skipped: values.skipped } } };
      }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/tours/skip-all", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  try {
    await executeWithAudit<any>(
      { req, event: "tour_skip_all", userId, critical: false },
      async () => {
        await db.update(tourProgress)
          .set({ globalSkip: true, skipped: true, updatedAt: new Date() })
          .where(eq(tourProgress.userId, userId));

        await db.insert(tourProgress)
          .values({
            userId,
            pageKey: "__global__",
            globalSkip: true,
            skipped: true,
            currentStep: 0,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [tourProgress.userId, tourProgress.pageKey],
            set: { globalSkip: true, skipped: true, updatedAt: new Date() },
          });

        return { data: { ok: true } };
      }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/tours/restart-all", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  try {
    await executeWithAudit<any>(
      { req, event: "tour_restart_all", userId, critical: false },
      async () => {
        await db.update(tourProgress)
          .set({ globalSkip: false, skipped: false, completed: false, currentStep: 0, updatedAt: new Date() })
          .where(eq(tourProgress.userId, userId));
        return { data: { ok: true } };
      }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/tours/overrides/:pageKey", async (req, res) => {
  try {
    const pageKey = String(req.params.pageKey);
    const rows = await db.select().from(tourStepOverrides)
      .where(and(eq(tourStepOverrides.pageKey, pageKey), eq(tourStepOverrides.isActive, true)))
      .orderBy(asc(tourStepOverrides.stepIndex));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/tours/overrides", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(tourStepOverrides)
      .orderBy(asc(tourStepOverrides.pageKey), asc(tourStepOverrides.stepIndex));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/tours/overrides", isAuthenticated, isAdmin, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { pageKey, stepIndex, title, body, targetSelector, placement, sortOrder, isActive } = req.body || {};
  if (!pageKey || typeof stepIndex !== "number") {
    return res.status(400).json({ message: "pageKey and stepIndex required" });
  }
  try {
    const result = await executeWithAudit<any>(
      { req, event: "tour_override_upserted", userId, resourceType: "tour_step_override", resourceId: `${pageKey}:${stepIndex}` },
      async () => {
        const [row] = await db.insert(tourStepOverrides)
          .values({
            pageKey,
            stepIndex,
            title: title ?? null,
            body: body ?? null,
            targetSelector: targetSelector ?? null,
            placement: placement ?? "bottom",
            sortOrder: sortOrder ?? stepIndex,
            isActive: isActive ?? true,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [tourStepOverrides.pageKey, tourStepOverrides.stepIndex],
            set: {
              title: title ?? null,
              body: body ?? null,
              targetSelector: targetSelector ?? null,
              placement: placement ?? "bottom",
              sortOrder: sortOrder ?? stepIndex,
              isActive: isActive ?? true,
              updatedAt: new Date(),
            },
          })
          .returning();
        return { data: row, auditOverrides: { metadata: { pageKey, stepIndex } } };
      }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/tours/overrides/:id", isAuthenticated, isAdmin, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
  try {
    await executeWithAudit<any>(
      { req, event: "tour_override_deleted", userId, resourceType: "tour_step_override", resourceId: String(id) },
      async () => {
        await db.delete(tourStepOverrides).where(eq(tourStepOverrides.id, id));
        return { data: { ok: true } };
      }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/tips/dismissed", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select({ tipKey: pageTipsDismissed.tipKey }).from(pageTipsDismissed)
      .where(eq(pageTipsDismissed.userId, userId));
    res.json(rows.map(r => r.tipKey));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/tips/dismiss", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { tipKey } = req.body || {};
  if (!tipKey || typeof tipKey !== "string") return res.status(400).json({ message: "tipKey required" });
  try {
    await executeWithAudit<any>(
      { req, event: "tip_dismissed", userId, resourceType: "page_tip", resourceId: tipKey, critical: false },
      async () => {
        await db.insert(pageTipsDismissed)
          .values({ userId, tipKey })
          .onConflictDoNothing({ target: [pageTipsDismissed.userId, pageTipsDismissed.tipKey] });
        return { data: { ok: true } };
      }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/changelog", async (_req, res) => {
  try {
    const rows = await db.select().from(featureChangelog)
      .where(eq(featureChangelog.isPublished, true))
      .orderBy(desc(featureChangelog.publishedAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/changelog/unviewed-count", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const viewRows = await db.select().from(changelogViews).where(eq(changelogViews.userId, userId)).limit(1);
    const lastViewed = viewRows[0]?.lastViewedAt;

    let count = 0;
    if (!lastViewed) {
      const [r] = await db.select({ c: sql<number>`count(*)::int` })
        .from(featureChangelog)
        .where(eq(featureChangelog.isPublished, true));
      count = r?.c || 0;
    } else {
      const [r] = await db.select({ c: sql<number>`count(*)::int` })
        .from(featureChangelog)
        .where(and(eq(featureChangelog.isPublished, true), sql`${featureChangelog.publishedAt} > ${lastViewed}`));
      count = r?.c || 0;
    }
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/changelog/viewed", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { version } = req.body || {};
  try {
    const result = await executeWithAudit<{ ok: true }>(
      { req, event: "changelog_viewed", userId, resourceType: "changelog_view", resourceId: version || null, critical: false },
      async () => {
        await db.insert(changelogViews)
          .values({ userId, lastViewedVersion: version || null, lastViewedAt: new Date() })
          .onConflictDoUpdate({
            target: changelogViews.userId,
            set: { lastViewedVersion: version || null, lastViewedAt: new Date() },
          });
        return { data: { ok: true as const }, auditOverrides: { metadata: { version: version || null } } };
      }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
