import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { requireProjectRole, requireWorkspaceRole } from "../../middleware/workspace";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "project";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(140).trim(),
  description: z.string().max(500).optional(),
});

projectsRouter.post("/", requireWorkspaceRole("DEVELOPER"), validate({ body: createSchema }), async (req, res, next) => {
  try {
    const { workspaceId, name, description } = req.body;
    const base = slugify(name);
    let slug = base;
    let i = 1;
    while (await prisma.project.findUnique({ where: { workspaceId_slug: { workspaceId, slug } } })) slug = `${base}-${++i}`;
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name,
        slug,
        description: description ?? null,
        environments: {
          create: [
            { name: "Development", isDefault: true, sortOrder: 0 },
            { name: "Staging", sortOrder: 1 },
            { name: "Production", sortOrder: 2 },
          ],
        },
      },
      include: { environments: true },
    });
    await logActivity({
      workspaceId,
      projectId: project.id,
      userId: req.user!.id,
      action: "created",
      entityType: "project",
      entityId: project.id,
      entityName: name,
    });
    res.status(201).json({ project });
  } catch (e) {
    next(e);
  }
});

projectsRouter.get("/:projectId", requireProjectRole("VIEWER"), async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        collections: {
          orderBy: { sortOrder: "asc" },
          include: {
            folders: { orderBy: { sortOrder: "asc" } },
            requests: { orderBy: { sortOrder: "asc" }, include: { assertions: { orderBy: { sortOrder: "asc" } } } },
          },
        },
        environments: { include: { variables: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!project) throw notFound();
    // Secret variable values never leave the server — the executor resolves
    // them from the database at send time.
    for (const env of project.environments) {
      for (const v of env.variables) {
        if (v.isSecret) v.value = "";
      }
    }
    res.json({ project: { ...project, role: req.memberRole } });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(140).trim().optional(),
  description: z.string().max(500).nullable().optional(),
});

projectsRouter.patch("/:projectId", requireProjectRole("DEVELOPER"), validate({ body: updateSchema }), async (req, res, next) => {
  try {
    const project = await prisma.project.update({ where: { id: req.params.projectId }, data: req.body });
    await logActivity({
      workspaceId: req.params.workspaceId,
      projectId: project.id,
      userId: req.user!.id,
      action: "updated",
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
    });
    res.json({ project });
  } catch (e) {
    next(e);
  }
});

projectsRouter.delete("/:projectId", requireProjectRole("ADMIN"), async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    await prisma.project.delete({ where: { id: req.params.projectId } });
    await logActivity({
      workspaceId: req.params.workspaceId,
      userId: req.user!.id,
      action: "deleted",
      entityType: "project",
      entityId: req.params.projectId,
      entityName: project?.name,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
