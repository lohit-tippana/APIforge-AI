import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { requireWorkspaceRole } from "../../middleware/workspace";

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get(
  "/workspaces/:workspaceId/search",
  requireWorkspaceRole("VIEWER"),
  validate({ query: z.object({ q: z.string().max(200).default("") }) }),
  async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "").trim();
      const workspaceId = req.params.workspaceId;
      if (q.length < 1) {
        return res.json({ results: { projects: [], collections: [], requests: [], environments: [], docs: [], members: [] } });
      }
      const contains = { contains: q };
      const [projects, collections, requests, docs, members] = await Promise.all([
        prisma.project.findMany({ where: { workspaceId, name: contains }, take: 8, select: { id: true, name: true, description: true } }),
        prisma.collection.findMany({ where: { name: contains, project: { workspaceId } }, take: 8, select: { id: true, name: true, projectId: true } }),
        prisma.request.findMany({
          where: { OR: [{ name: contains }, { url: contains }], collection: { project: { workspaceId } } },
          take: 12,
          select: { id: true, name: true, method: true, url: true, collection: { select: { projectId: true } } },
        }),
        prisma.documentation.findMany({ where: { title: contains, project: { workspaceId } }, take: 8, select: { id: true, title: true, projectId: true } }),
        prisma.workspaceMember.findMany({
          where: { workspaceId, user: { OR: [{ name: contains }, { email: contains }] } },
          take: 8,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
      ]);
      res.json({
        results: {
          projects,
          collections,
          requests: requests.map((r) => ({ id: r.id, name: r.name, method: r.method, url: r.url, projectId: r.collection.projectId })),
          docs,
          members: members.map((m) => ({ ...m.user, role: m.role })),
        },
      });
    } catch (e) {
      next(e);
    }
  },
);
