import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { randomToken } from "../../lib/crypto";
import { badRequest, notFound } from "../../lib/errors";
import { logActivity, notify } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { requireWorkspaceRole } from "../../middleware/workspace";

export const teamRouter = Router();
teamRouter.use(requireAuth);

const inviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["ADMIN", "DEVELOPER", "VIEWER"]).default("DEVELOPER"),
});

teamRouter.post("/workspaces/:workspaceId/invites", requireWorkspaceRole("ADMIN"), validate({ body: inviteSchema }), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const workspaceId = req.params.workspaceId;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: existingUser.id } } });
      if (member) throw badRequest("User is already a member");
      // Existing users join directly.
      await prisma.workspaceMember.create({ data: { workspaceId, userId: existingUser.id, role } });
      await notify({
        userId: existingUser.id,
        workspaceId,
        type: "WORKSPACE_INVITE",
        title: `You were added to a workspace`,
        body: `${req.user!.name} added you to the workspace`,
      });
      await logActivity({ workspaceId, userId: req.user!.id, action: "invited", entityType: "member", entityId: existingUser.id, entityName: existingUser.name });
      return res.status(201).json({ added: true, member: { user: existingUser, role } });
    }
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role,
        token: randomToken(24),
        invitedById: req.user!.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    await logActivity({ workspaceId, userId: req.user!.id, action: "invited", entityType: "member", entityId: null, entityName: email });
    res.status(201).json({ added: false, invite: { id: invite.id, email: invite.email, role: invite.role, token: invite.token } });
  } catch (e) {
    next(e);
  }
});

teamRouter.get("/workspaces/:workspaceId/invites", requireWorkspaceRole("ADMIN"), async (req, res, next) => {
  try {
    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: req.params.workspaceId, status: "PENDING" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ invites });
  } catch (e) {
    next(e);
  }
});

teamRouter.delete("/workspaces/:workspaceId/invites/:inviteId", requireWorkspaceRole("ADMIN"), async (req, res, next) => {
  try {
    await prisma.workspaceInvite.update({ where: { id: req.params.inviteId }, data: { status: "REVOKED" } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Accept an invite link.
teamRouter.post("/invites/accept", validate({ body: z.object({ token: z.string().min(10) }) }), async (req, res, next) => {
  try {
    const invite = await prisma.workspaceInvite.findUnique({ where: { token: req.body.token }, include: { workspace: true } });
    if (!invite || invite.status !== "PENDING") throw notFound("Invite not found or already used");
    if (invite.expiresAt < new Date()) {
      await prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
      throw badRequest("Invite expired");
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.email !== invite.email) throw badRequest("This invite was sent to a different email address");
    await prisma.$transaction([
      prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } }),
      prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
        create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
        update: { role: invite.role },
      }),
    ]);
    res.json({ workspace: invite.workspace });
  } catch (e) {
    next(e);
  }
});
