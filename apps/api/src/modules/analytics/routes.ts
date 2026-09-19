import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireProjectRole } from "../../middleware/workspace";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// Aggregated project metrics — all computed from real RequestHistory/TestRun data.
analyticsRouter.get("/projects/:projectId/analytics", requireProjectRole("VIEWER"), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [history, runs, requests, collections] = await Promise.all([
      prisma.requestHistory.findMany({
        where: { projectId, createdAt: { gte: since } },
        select: { statusCode: true, responseTimeMs: true, createdAt: true, userId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.testRun.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.request.count({ where: { collection: { projectId } } }),
      prisma.collection.count({ where: { projectId } }),
    ]);

    const totalRequests = history.length;
    const successful = history.filter((h) => h.statusCode && h.statusCode < 400).length;
    const failedReqs = totalRequests - successful;
    const times = history.map((h) => h.responseTimeMs ?? 0).filter((t) => t > 0);
    const avgResponseTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    // Daily series for charts
    const byDay = new Map<string, { total: number; success: number; failed: number; timeSum: number }>();
    for (const h of history) {
      const day = h.createdAt.toISOString().slice(0, 10);
      const d = byDay.get(day) ?? { total: 0, success: 0, failed: 0, timeSum: 0 };
      d.total++;
      if (h.statusCode && h.statusCode < 400) d.success++;
      else d.failed++;
      d.timeSum += h.responseTimeMs ?? 0;
      byDay.set(day, d);
    }
    const daily = [...byDay.entries()].map(([date, d]) => ({
      date,
      requests: d.total,
      success: d.success,
      failed: d.failed,
      avgTime: d.total ? Math.round(d.timeSum / d.total) : 0,
    }));

    // Status code distribution
    const statusDist = new Map<string, number>();
    for (const h of history) {
      const bucket = h.statusCode ? `${Math.floor(h.statusCode / 100)}xx` : "ERR";
      statusDist.set(bucket, (statusDist.get(bucket) ?? 0) + 1);
    }

    res.json({
      analytics: {
        totalRequests,
        successful,
        failed: failedReqs,
        successRate: totalRequests ? Math.round((successful / totalRequests) * 100) : 0,
        avgResponseTime,
        testRuns: runs.length,
        recentRuns: runs.slice(0, 5),
        requests,
        collections,
        activeMembers: new Set(history.map((h) => h.userId)).size,
        daily,
        statusDistribution: [...statusDist.entries()].map(([name, value]) => ({ name, value })),
      },
    });
  } catch (e) {
    next(e);
  }
});
