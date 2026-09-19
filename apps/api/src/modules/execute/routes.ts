import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { executeRequest } from "../../lib/executor";
import { badRequest } from "../../lib/errors";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { requireProjectRole } from "../../middleware/workspace";

export const executeRouter = Router();
executeRouter.use(requireAuth);

const executeSchema = z.object({
  projectId: z.string().min(1),
  requestId: z.string().nullable().optional(),
  environmentId: z.string().nullable().optional(),
  method: z.string().max(10).default("GET"),
  url: z.string().max(4000),
  headers: z.array(z.object({ key: z.string().max(200), value: z.string().max(4000), enabled: z.boolean().default(true) })).default([]),
  params: z.array(z.object({ key: z.string().max(200), value: z.string().max(4000), enabled: z.boolean().default(true) })).default([]),
  bodyType: z.string().max(20).default("NONE"),
  body: z.string().nullable().optional(),
  authType: z.string().max(20).default("NONE"),
  authConfig: z.record(z.string(), z.unknown()).nullable().optional(),
});

executeRouter.post("/execute", validate({ body: executeSchema }), async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) =>
      requireProjectRole("VIEWER")(req, res, (e) => (e ? reject(e) : resolve())),
    );
    const input = req.body;
    const result = await executeRequest(input).catch((e: Error & { code?: string }) => {
      if (e.code === "NETWORK" || e.code === "BAD_URL" || e.code === "EMPTY_URL" || e.code === "UNRESOLVED_VARS") {
        throw badRequest(e.message, { code: e.code });
      }
      throw e;
    });

    // Fire-and-forget history record
    prisma.requestHistory
      .create({
        data: {
          projectId: input.projectId,
          requestId: input.requestId ?? null,
          userId: req.user!.id,
          method: input.method,
          url: result.request.url.slice(0, 2000),
          statusCode: result.status,
          responseTimeMs: result.timeMs,
          responseSize: result.sizeBytes,
        },
      })
      .catch(() => {});

    res.json({ response: result });
  } catch (e) {
    next(e);
  }
});

// ── History ─────────────────────────────────────────────────

executeRouter.get("/projects/:projectId/history", requireProjectRole("VIEWER"), async (req, res, next) => {
  try {
    const history = await prisma.requestHistory.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true } }, request: { select: { id: true, name: true } } },
    });
    res.json({ history });
  } catch (e) {
    next(e);
  }
});

executeRouter.delete("/projects/:projectId/history", requireProjectRole("DEVELOPER"), async (req, res, next) => {
  try {
    await prisma.requestHistory.deleteMany({ where: { projectId: req.params.projectId } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
