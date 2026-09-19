import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { projectAccess, requireProjectRole } from "../../middleware/workspace";

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const BODY_TYPES = ["NONE", "JSON", "FORM", "URLENCODED", "RAW"] as const;
const AUTH_TYPES = ["NONE", "BEARER", "BASIC", "APIKEY"] as const;

async function projectOfCollection(id: string) {
  return (await prisma.collection.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
}
async function projectOfFolder(id: string) {
  const f = await prisma.folder.findUnique({ where: { id }, select: { collectionId: true } });
  return f ? projectOfCollection(f.collectionId) : null;
}
async function projectOfRequest(id: string) {
  const r = await prisma.request.findUnique({ where: { id }, select: { collectionId: true } });
  return r ? projectOfCollection(r.collectionId) : null;
}

const collectionAccess = (role: "VIEWER" | "DEVELOPER" | "ADMIN") =>
  projectAccess(role, (req) => projectOfCollection(req.params.id));
const folderAccess = (role: "VIEWER" | "DEVELOPER" | "ADMIN") =>
  projectAccess(role, (req) => projectOfFolder(req.params.id));
const requestAccess = (role: "VIEWER" | "DEVELOPER" | "ADMIN") =>
  projectAccess(role, (req) => projectOfRequest(req.params.id));

// ── Collections ─────────────────────────────────────────────

const collectionCreate = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(160).trim(),
  description: z.string().max(500).optional(),
});

collectionsRouter.post(
  "/collections",
  validate({ body: collectionCreate }),
  requireProjectRole("DEVELOPER"),
  async (req, res, next) => {
    try {
      const max = await prisma.collection.aggregate({
        where: { projectId: req.body.projectId },
        _max: { sortOrder: true },
      });
      const collection = await prisma.collection.create({
        data: {
          projectId: req.body.projectId,
          name: req.body.name,
          description: req.body.description ?? null,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
        },
      });
      await logActivity({
        workspaceId: req.params.workspaceId,
        projectId: req.body.projectId,
        userId: req.user!.id,
        action: "created",
        entityType: "collection",
        entityId: collection.id,
        entityName: collection.name,
      });
      res.status(201).json({ collection });
    } catch (e) {
      next(e);
    }
  },
);

collectionsRouter.patch("/collections/:id", collectionAccess("DEVELOPER"), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(160).trim().optional(),
      description: z.string().max(500).nullable().optional(),
      sortOrder: z.number().int().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.collection.update({ where: { id: req.params.id }, data });
    res.json({ collection: updated });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.delete("/collections/:id", collectionAccess("DEVELOPER"), async (req, res, next) => {
  try {
    const collection = await prisma.collection.findUnique({ where: { id: req.params.id } });
    await prisma.collection.delete({ where: { id: req.params.id } });
    await logActivity({
      workspaceId: req.params.workspaceId,
      projectId: req.params.projectId,
      userId: req.user!.id,
      action: "deleted",
      entityType: "collection",
      entityId: req.params.id,
      entityName: collection?.name,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Folders ─────────────────────────────────────────────────

const folderCreate = z.object({
  collectionId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  name: z.string().min(1).max(160).trim(),
});

collectionsRouter.post("/folders", validate({ body: folderCreate }), async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) =>
      projectAccess("DEVELOPER", () => projectOfCollection(req.body.collectionId))(req, res, (e) =>
        e ? reject(e) : resolve(),
      ),
    );
    const folder = await prisma.folder.create({
      data: { collectionId: req.body.collectionId, parentId: req.body.parentId ?? null, name: req.body.name },
    });
    res.status(201).json({ folder });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.patch("/folders/:id", folderAccess("DEVELOPER"), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(160).trim().optional(),
      parentId: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.folder.update({ where: { id: req.params.id }, data });
    res.json({ folder: updated });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.delete("/folders/:id", folderAccess("DEVELOPER"), async (req, res, next) => {
  try {
    await prisma.folder.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Requests ────────────────────────────────────────────────

const kvSchema = z.array(
  z.object({ key: z.string().max(200), value: z.string().max(2000), enabled: z.boolean().default(true) }),
);

const assertionSchema = z.object({
  type: z.string().max(40),
  target: z.string().max(500).nullable().optional(),
  operator: z.string().max(20).nullable().optional(),
  expected: z.string().max(4000).nullable().optional(),
  enabled: z.boolean().default(true),
});

const requestUpsert = z.object({
  collectionId: z.string().min(1),
  folderId: z.string().nullable().optional(),
  name: z.string().min(1).max(200).trim(),
  method: z.enum(METHODS).default("GET"),
  url: z.string().max(2000).default(""),
  bodyType: z.enum(BODY_TYPES).default("NONE"),
  body: z.string().nullable().optional(),
  authType: z.enum(AUTH_TYPES).default("NONE"),
  authConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  headers: kvSchema.default([]),
  params: kvSchema.default([]),
  assertions: z.array(assertionSchema).default([]),
});

type KvRow = { key: string; value: string; enabled: boolean };
const kvData = (rows: KvRow[]) =>
  rows.filter((r) => r.key.trim()).map((r, i) => ({ key: r.key, value: r.value, enabled: r.enabled, sortOrder: i }));

const assertionData = (rows: z.infer<typeof assertionSchema>[]) =>
  rows.map((a, i) => ({
    type: a.type,
    target: a.target ?? null,
    operator: a.operator ?? null,
    expected: a.expected ?? null,
    enabled: a.enabled,
    sortOrder: i,
  }));

collectionsRouter.post("/requests", validate({ body: requestUpsert }), async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) =>
      projectAccess("DEVELOPER", () => projectOfCollection(req.body.collectionId))(req, res, (e) =>
        e ? reject(e) : resolve(),
      ),
    );
    const { headers, params, assertions, ...data } = req.body;
    const max = await prisma.request.aggregate({
      where: { collectionId: data.collectionId, folderId: data.folderId ?? null },
      _max: { sortOrder: true },
    });
    const request = await prisma.request.create({
      data: {
        ...data,
        folderId: data.folderId ?? null,
        body: data.body ?? null,
        authConfig: data.authConfig ?? undefined,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        createdById: req.user!.id,
        headers: { create: kvData(headers) },
        params: { create: kvData(params) },
        assertions: { create: assertionData(assertions) },
      },
      include: { headers: true, params: true, assertions: true },
    });
    await logActivity({
      workspaceId: req.params.workspaceId,
      projectId: req.params.projectId,
      userId: req.user!.id,
      action: "created",
      entityType: "request",
      entityId: request.id,
      entityName: request.name,
    });
    res.status(201).json({ request });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.get("/requests/:id", requestAccess("VIEWER"), async (req, res, next) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: {
        headers: { orderBy: { sortOrder: "asc" } },
        params: { orderBy: { sortOrder: "asc" } },
        assertions: { orderBy: { sortOrder: "asc" } },
      },
    });
    res.json({ request });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.put("/requests/:id", requestAccess("DEVELOPER"), validate({ body: requestUpsert.omit({ collectionId: true }) }), async (req, res, next) => {
  try {
    const { headers, params, assertions, ...data } = req.body;
    const request = await prisma.$transaction(async (tx) => {
      await tx.requestHeader.deleteMany({ where: { requestId: req.params.id } });
      await tx.requestParam.deleteMany({ where: { requestId: req.params.id } });
      await tx.testAssertion.deleteMany({ where: { requestId: req.params.id } });
      return tx.request.update({
        where: { id: req.params.id },
        data: {
          ...data,
          folderId: data.folderId ?? null,
          body: data.body ?? null,
          authConfig: data.authConfig ?? undefined,
          headers: { create: kvData(headers ?? []) },
          params: { create: kvData(params ?? []) },
          assertions: { create: assertionData(assertions ?? []) },
        },
        include: { headers: true, params: true, assertions: true },
      });
    });
    res.json({ request });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.post("/requests/:id/duplicate", requestAccess("DEVELOPER"), async (req, res, next) => {
  try {
    const source = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: { headers: true, params: true, assertions: true },
    });
    if (!source) throw notFound();
    const copy = await prisma.request.create({
      data: {
        collectionId: source.collectionId,
        folderId: source.folderId,
        name: `${source.name} copy`,
        method: source.method,
        url: source.url,
        bodyType: source.bodyType,
        body: source.body,
        authType: source.authType,
        authConfig: source.authConfig ?? undefined,
        sortOrder: source.sortOrder + 1,
        headers: { create: source.headers.map(({ key, value, enabled, sortOrder }) => ({ key, value, enabled, sortOrder })) },
        params: { create: source.params.map(({ key, value, enabled, sortOrder }) => ({ key, value, enabled, sortOrder })) },
        assertions: {
          create: source.assertions.map(({ type, target, operator, expected, enabled, sortOrder }) => ({
            type,
            target,
            operator,
            expected,
            enabled,
            sortOrder,
          })),
        },
      },
      include: { headers: true, params: true, assertions: true },
    });
    res.status(201).json({ request: copy });
  } catch (e) {
    next(e);
  }
});

collectionsRouter.delete("/requests/:id", requestAccess("DEVELOPER"), async (req, res, next) => {
  try {
    const request = await prisma.request.findUnique({ where: { id: req.params.id } });
    await prisma.request.delete({ where: { id: req.params.id } });
    await logActivity({
      workspaceId: req.params.workspaceId,
      projectId: req.params.projectId,
      userId: req.user!.id,
      action: "deleted",
      entityType: "request",
      entityId: req.params.id,
      entityName: request?.name,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Reorder ─────────────────────────────────────────────────

const reorderSchema = z.object({
  collectionId: z.string(),
  items: z.array(
    z.object({ id: z.string(), kind: z.enum(["request", "folder"]), sortOrder: z.number().int(), folderId: z.string().nullable().optional() }),
  ),
});

collectionsRouter.post("/reorder", validate({ body: reorderSchema }), async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) =>
      projectAccess("DEVELOPER", () => projectOfCollection(req.body.collectionId))(req, res, (e) =>
        e ? reject(e) : resolve(),
      ),
    );
    const items = req.body.items as { id: string; kind: string; sortOrder: number; folderId?: string | null }[];
    await prisma.$transaction(
      items.map((i) =>
        i.kind === "request"
          ? prisma.request.updateMany({ where: { id: i.id }, data: { sortOrder: i.sortOrder, folderId: i.folderId } })
          : prisma.folder.updateMany({ where: { id: i.id }, data: { sortOrder: i.sortOrder } }),
      ),
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
