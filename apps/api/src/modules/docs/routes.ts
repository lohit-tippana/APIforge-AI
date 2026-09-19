import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { projectAccess, requireProjectRole } from "../../middleware/workspace";

export const docsRouter = Router();
docsRouter.use(requireAuth);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180) || "doc";

async function projectOfDoc(id: string) {
  return (await prisma.documentation.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
}

docsRouter.get("/projects/:projectId/docs", requireProjectRole("VIEWER"), async (req, res, next) => {
  try {
    const docs = await prisma.documentation.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, slug: true, source: true, published: true, updatedAt: true, collectionId: true },
    });
    res.json({ docs });
  } catch (e) {
    next(e);
  }
});

const docUpsert = z.object({
  projectId: z.string().min(1),
  collectionId: z.string().nullable().optional(),
  title: z.string().min(1).max(200).trim(),
  content: z.string().max(500_000).default(""),
  source: z.enum(["MANUAL", "AI", "GENERATED"]).default("MANUAL"),
  published: z.boolean().default(false),
});

docsRouter.post("/docs", validate({ body: docUpsert }), requireProjectRole("DEVELOPER"), async (req, res, next) => {
  try {
    const { projectId, title } = req.body;
    const base = slugify(title);
    let slug = base;
    let i = 1;
    while (await prisma.documentation.findUnique({ where: { projectId_slug: { projectId, slug } } })) slug = `${base}-${++i}`;
    const doc = await prisma.documentation.create({ data: { ...req.body, slug } });
    await logActivity({ workspaceId: req.params.workspaceId, projectId, userId: req.user!.id, action: "created", entityType: "doc", entityId: doc.id, entityName: title });
    res.status(201).json({ doc });
  } catch (e) {
    next(e);
  }
});

docsRouter.get("/docs/:id", projectAccess("VIEWER", (req) => projectOfDoc(req.params.id)), async (req, res, next) => {
  try {
    const doc = await prisma.documentation.findUnique({ where: { id: req.params.id } });
    res.json({ doc });
  } catch (e) {
    next(e);
  }
});

docsRouter.put("/docs/:id", projectAccess("DEVELOPER", (req) => projectOfDoc(req.params.id)), async (req, res, next) => {
  try {
    const schema = docUpsert.omit({ projectId: true }).partial();
    const data = schema.parse(req.body);
    const doc = await prisma.documentation.update({ where: { id: req.params.id }, data });
    res.json({ doc });
  } catch (e) {
    next(e);
  }
});

docsRouter.delete("/docs/:id", projectAccess("DEVELOPER", (req) => projectOfDoc(req.params.id)), async (req, res, next) => {
  try {
    const doc = await prisma.documentation.findUnique({ where: { id: req.params.id } });
    await prisma.documentation.delete({ where: { id: req.params.id } });
    await logActivity({ workspaceId: req.params.workspaceId, projectId: req.params.projectId, userId: req.user!.id, action: "deleted", entityType: "doc", entityId: req.params.id, entityName: doc?.title });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Generate docs from a collection's saved requests (deterministic, no AI key needed).
docsRouter.post("/docs/generate/:collectionId", projectAccess("DEVELOPER", async (req) => {
  const c = await prisma.collection.findUnique({ where: { id: req.params.collectionId }, select: { projectId: true } });
  return c?.projectId ?? null;
}), async (req, res, next) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: req.params.collectionId },
      include: {
        folders: { orderBy: { sortOrder: "asc" } },
        requests: {
          orderBy: { sortOrder: "asc" },
          include: { headers: true, params: true, assertions: true },
        },
      },
    });
    if (!collection) throw notFound("Collection not found");

    const lines: string[] = [`# ${collection.name}`, ""];
    if (collection.description) lines.push(collection.description, "");
    const folderName = new Map(collection.folders.map((f) => [f.id, f.name]));
    let currentFolder: string | null | undefined = undefined;
    for (const r of collection.requests) {
      const folder = r.folderId ? folderName.get(r.folderId) ?? null : null;
      if (folder !== currentFolder) {
        currentFolder = folder;
        if (folder) lines.push(`## ${folder}`, "");
      }
      lines.push(`### \`${r.method} ${r.url}\``, "", `**${r.name}**`, "");
      if (r.authType !== "NONE") lines.push(`**Auth:** ${r.authType}`, "");
      if (r.params.length) {
        lines.push("| Param | Value |", "| --- | --- |");
        for (const p of r.params.filter((p) => p.enabled)) lines.push(`| \`${p.key}\` | ${p.value} |`);
        lines.push("");
      }
      if (r.headers.length) {
        lines.push("| Header | Value |", "| --- | --- |");
        for (const h of r.headers.filter((h) => h.enabled)) lines.push(`| \`${h.key}\` | ${h.value} |`);
        lines.push("");
      }
      if (r.body && r.bodyType !== "NONE") lines.push("```json", r.body, "```", "");
    }

    const projectId = collection.projectId;
    const slug = slugify(collection.name);
    const existing = await prisma.documentation.findUnique({ where: { projectId_slug: { projectId, slug } } });
    const doc = existing
      ? await prisma.documentation.update({ where: { id: existing.id }, data: { content: lines.join("\n"), source: "GENERATED" } })
      : await prisma.documentation.create({ data: { projectId, collectionId: collection.id, title: collection.name, slug, content: lines.join("\n"), source: "GENERATED" } });
    await logActivity({ workspaceId: req.params.workspaceId, projectId, userId: req.user!.id, action: "generated", entityType: "doc", entityId: doc.id, entityName: doc.title });
    res.status(201).json({ doc });
  } catch (e) {
    next(e);
  }
});
