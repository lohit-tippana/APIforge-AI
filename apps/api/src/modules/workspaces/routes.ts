import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { requireWorkspaceRole } from "../../middleware/workspace";

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "workspace";

async function uniqueWorkspaceSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) slug = `${base}-${++i}`;
  return slug;
}

const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  icon: z.string().max(40).optional(),
});

workspacesRouter.get("/", async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id },
      include: { workspace: { include: { _count: { select: { members: true, projects: true } } } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      workspaces: memberships.map((m) => ({
        ...m.workspace,
        role: m.role,
        memberCount: m.workspace._count.members,
        projectCount: m.workspace._count.projects,
      })),
    });
  } catch (e) {
    next(e);
  }
});

workspacesRouter.post("/", validate({ body: createSchema }), async (req, res, next) => {
  try {
    const slug = await uniqueWorkspaceSlug(req.body.name);
    const workspace = await prisma.workspace.create({
      data: {
        name: req.body.name,
        icon: req.body.icon ?? null,
        slug,
        members: { create: { userId: req.user!.id, role: "OWNER" } },
      },
    });
    await logActivity({
      workspaceId: workspace.id,
      userId: req.user!.id,
      action: "created",
      entityType: "workspace",
      entityId: workspace.id,
      entityName: workspace.name,
    });
    res.status(201).json({ workspace });
  } catch (e) {
    next(e);
  }
});

workspacesRouter.get("/:workspaceId", requireWorkspaceRole("VIEWER"), async (req, res, next) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.workspaceId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        projects: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!workspace) throw notFound();
    res.json({ workspace: { ...workspace, role: req.memberRole } });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  icon: z.string().max(40).nullable().optional(),
});

workspacesRouter.patch("/:workspaceId", requireWorkspaceRole("ADMIN"), validate({ body: updateSchema }), async (req, res, next) => {
  try {
    const workspace = await prisma.workspace.update({ where: { id: req.params.workspaceId }, data: req.body });
    await logActivity({
      workspaceId: workspace.id,
      userId: req.user!.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace.id,
      entityName: workspace.name,
    });
    res.json({ workspace });
  } catch (e) {
    next(e);
  }
});

workspacesRouter.delete("/:workspaceId", requireWorkspaceRole("OWNER"), async (req, res, next) => {
  try {
    await prisma.workspace.delete({ where: { id: req.params.workspaceId } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Members ─────────────────────────────────────────────────

const roleSchema = z.object({ role: z.enum(["ADMIN", "DEVELOPER", "VIEWER"]) });

workspacesRouter.patch("/:workspaceId/members/:userId", requireWorkspaceRole("ADMIN"), validate({ body: roleSchema }), async (req, res, next) => {
  try {
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.params.userId } },
    });
    if (!target) throw notFound("Member not found");
    if (target.role === "OWNER") throw badRequest("Cannot change the owner's role");
    const member = await prisma.workspaceMember.update({ where: { id: target.id }, data: { role: req.body.role } });
    res.json({ member });
  } catch (e) {
    next(e);
  }
});

workspacesRouter.delete("/:workspaceId/members/:userId", requireWorkspaceRole("ADMIN"), async (req, res, next) => {
  try {
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.params.userId } },
      include: { user: true },
    });
    if (!target) throw notFound("Member not found");
    if (target.role === "OWNER") throw badRequest("Cannot remove the workspace owner");
    await prisma.workspaceMember.delete({ where: { id: target.id } });
    await logActivity({
      workspaceId: req.params.workspaceId,
      userId: req.user!.id,
      action: "removed",
      entityType: "member",
      entityId: target.userId,
      entityName: target.user.name,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
