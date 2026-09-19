import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireWorkspaceRole } from "../../middleware/workspace";

export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get("/workspaces/:workspaceId/activity", requireWorkspaceRole("VIEWER"), async (req, res, next) => {
  try {
    const activity = await prisma.activityLog.findMany({
      where: { workspaceId: req.params.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ activity });
  } catch (e) {
    next(e);
  }
});
