import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { executeRequest } from "../../lib/executor";
import { evaluateAssertions, type Assertion } from "../../lib/assertions";
import { notFound } from "../../lib/errors";
import { logActivity, notify } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { projectAccess, requireProjectRole } from "../../middleware/workspace";
import { emitToProject } from "../../lib/socket";

export const testsRouter = Router();
testsRouter.use(requireAuth);

type RequestRow = {
  id: string; name: string; method: string; url: string; bodyType: string; body: string | null;
  authType: string; authConfig: unknown; folderId: string | null; sortOrder: number;
  headers: { key: string; value: string; enabled: boolean }[];
  params: { key: string; value: string; enabled: boolean }[];
  assertions: Assertion[];
};
type FolderRow = { id: string; parentId: string | null; sortOrder: number };

// Flatten the collection tree depth-first so the runner follows the order
// users see in the sidebar.
function flattenTree(folders: FolderRow[], requests: RequestRow[]): RequestRow[] {
  const out: RequestRow[] = [];
  const walk = (folderId: string | null) => {
    const items = [
      ...folders.filter((f) => f.parentId === folderId).map((f) => ({ kind: "folder" as const, sort: f.sortOrder, id: f.id })),
      ...requests.filter((r) => r.folderId === folderId).map((r) => ({ kind: "request" as const, sort: r.sortOrder, id: r.id })),
    ].sort((a, b) => a.sort - b.sort);
    for (const item of items) {
      if (item.kind === "request") out.push(requests.find((r) => r.id === item.id)!);
      else walk(item.id);
    }
  };
  walk(null);
  return out;
}

const runCreate = z.object({
  collectionId: z.string().min(1),
  environmentId: z.string().nullable().optional(),
});

testsRouter.post("/test-runs", validate({ body: runCreate }), async (req, res, next) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: req.body.collectionId },
      include: {
        folders: { orderBy: { sortOrder: "asc" } },
        requests: {
          orderBy: { sortOrder: "asc" },
          include: { headers: true, params: true, assertions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!collection) throw notFound("Collection not found");

    await new Promise<void>((resolve, reject) =>
      projectAccess("DEVELOPER", async () => collection.projectId)(req, res, (e) => (e ? reject(e) : resolve())),
    );

    const requests = flattenTree(collection.folders, collection.requests as RequestRow[]);
    const run = await prisma.testRun.create({
      data: {
        projectId: collection.projectId,
        collectionId: collection.id,
        environmentId: req.body.environmentId ?? null,
        name: `${collection.name} run`,
        totalRequests: requests.length,
        triggeredById: req.user!.id,
      },
    });

    // Execute sequentially — requests may depend on order (e.g. auth → data).
    let passed = 0, failed = 0, skipped = 0;
    const runStart = Date.now();
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      let status = "PASSED";
      let statusCode: number | null = null;
      let timeMs: number | null = null;
      let error: string | null = null;
      let log: ReturnType<typeof evaluateAssertions> = [];

      try {
        const result = await executeRequest({
          method: r.method,
          url: r.url,
          headers: r.headers,
          params: r.params,
          bodyType: r.bodyType,
          body: r.body,
          authType: r.authType,
          authConfig: (r.authConfig as Record<string, unknown>) ?? null,
          environmentId: req.body.environmentId ?? null,
        });
        statusCode = result.status;
        timeMs = result.timeMs;
        if (r.assertions.length === 0) {
          status = "PASSED";
        } else {
          log = evaluateAssertions(r.assertions, result);
          const f = log.filter((l) => l.status === "FAILED").length;
          const s = log.filter((l) => l.status === "SKIPPED").length;
          status = f > 0 ? "FAILED" : log.length === s ? "SKIPPED" : "PASSED";
        }
      } catch (e) {
        status = "ERROR";
        error = (e as Error).message.slice(0, 1000);
        log = r.assertions.map((a) => ({ type: a.type, description: "", status: "SKIPPED" as const }));
      }

      const p = log.filter((l) => l.status === "PASSED").length;
      const f = log.filter((l) => l.status === "FAILED").length;
      const s = log.filter((l) => l.status === "SKIPPED").length;
      if (status === "PASSED") passed++;
      else if (status === "SKIPPED") skipped++;
      else failed++;

      const result = await prisma.testResult.create({
        data: {
          testRunId: run.id,
          requestId: r.id,
          requestName: r.name,
          method: r.method,
          url: r.url.slice(0, 2000),
          status,
          statusCode,
          responseTimeMs: timeMs,
          error,
          passed: p,
          failed: f,
          skipped: s,
          assertionLog: log as never,
          sortOrder: i,
        },
      });
      emitToProject(collection.projectId, "test-run:progress", { runId: run.id, result });
    }

    const durationMs = Date.now() - runStart;
    const finalStatus = requests.length === 0 ? "PASSED" : failed > 0 ? "FAILED" : "PASSED";
    const finished = await prisma.testRun.update({
      where: { id: run.id },
      data: { status: finalStatus, passed, failed, skipped, durationMs },
      include: { results: { orderBy: { sortOrder: "asc" } } },
    });

    await logActivity({
      workspaceId: req.params.workspaceId,
      projectId: collection.projectId,
      userId: req.user!.id,
      action: "ran",
      entityType: "collection",
      entityId: collection.id,
      entityName: collection.name,
      meta: { runId: run.id, passed, failed },
    });
    if (finalStatus === "FAILED") {
      await notify({
        userId: req.user!.id,
        workspaceId: req.params.workspaceId,
        type: "TEST_RUN_FAILED",
        title: `Test run failed: ${collection.name}`,
        body: `${failed} of ${requests.length} requests failed`,
        meta: { runId: run.id },
      });
    }
    emitToProject(collection.projectId, "test-run:complete", { runId: run.id, status: finalStatus });
    res.status(201).json({ testRun: finished });
  } catch (e) {
    next(e);
  }
});

testsRouter.get("/projects/:projectId/test-runs", requireProjectRole("VIEWER"), async (req, res, next) => {
  try {
    const runs = await prisma.testRun.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { collection: { select: { name: true } } },
    });
    res.json({ testRuns: runs });
  } catch (e) {
    next(e);
  }
});

testsRouter.get("/test-runs/:id", async (req, res, next) => {
  try {
    const run = await prisma.testRun.findUnique({
      where: { id: req.params.id },
      include: { results: { orderBy: { sortOrder: "asc" } }, collection: { select: { name: true } } },
    });
    if (!run) throw notFound();
    await new Promise<void>((resolve, reject) =>
      projectAccess("VIEWER", async () => run.projectId)(req, res, (e) => (e ? reject(e) : resolve())),
    );
    res.json({ testRun: run });
  } catch (e) {
    next(e);
  }
});
