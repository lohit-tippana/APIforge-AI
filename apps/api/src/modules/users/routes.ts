import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashPassword, randomToken, sha256, verifyPassword } from "../../lib/crypto";
import { badRequest } from "../../lib/errors";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// ── Profile ─────────────────────────────────────────────────

usersRouter.patch("/me", validate({ body: z.object({ name: z.string().min(1).max(120).trim().optional(), avatarUrl: z.string().url().max(500).nullable().optional() }) }), async (req, res, next) => {
  try {
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: req.body, select: { id: true, name: true, email: true, avatarUrl: true } });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/me/password", validate({ body: z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/) }) }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!verifyPassword(req.body.currentPassword, user.passwordHash)) throw badRequest("Current password is incorrect");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(req.body.newPassword) } });
    // Revoke all other sessions.
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── API keys ────────────────────────────────────────────────

usersRouter.get("/me/api-keys", async (req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user!.id },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ apiKeys: keys });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/me/api-keys", validate({ body: z.object({ name: z.string().min(1).max(120).trim() }) }), async (req, res, next) => {
  try {
    const secret = `afk_${randomToken(24)}`;
    const key = await prisma.apiKey.create({
      data: { userId: req.user!.id, name: req.body.name, prefix: secret.slice(0, 12), keyHash: sha256(secret) },
      select: { id: true, name: true, prefix: true, createdAt: true },
    });
    // Full key is shown exactly once.
    res.status(201).json({ apiKey: key, secret });
  } catch (e) {
    next(e);
  }
});

usersRouter.delete("/me/api-keys/:id", async (req, res, next) => {
  try {
    await prisma.apiKey.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
