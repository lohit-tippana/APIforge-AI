import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../../config";
import { prisma } from "../../lib/prisma";
import { hashPassword, randomToken, sha256, verifyPassword } from "../../lib/crypto";
import { badRequest, unauthorized } from "../../lib/errors";
import { signAccessToken } from "../../lib/jwt";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../lib/validate";

export const authRouter = Router();

const cookieOpts = (maxAgeSec: number) =>
  ({
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec * 1000,
  });

async function issueSession(userId: string, req: Request, res: Response, replacedBy?: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const refresh = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + config.jwt.refreshTtl * 1000),
      replacedBy: replacedBy ?? null,
      userAgent: req.headers["user-agent"]?.slice(0, 300) ?? null,
      ip: req.ip ?? null,
    },
  });
  const access = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  res.cookie(config.cookies.access, access, cookieOpts(config.jwt.accessTtl));
  res.cookie(config.cookies.refresh, refresh, cookieOpts(config.jwt.refreshTtl));
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-zA-Z]/, "Must contain a letter")
  .regex(/[0-9]/, "Must contain a number");

const registerSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  password: passwordSchema,
});

authRouter.post("/register", validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw badRequest("An account with this email already exists");
    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashPassword(password) },
    });
    const session = await issueSession(user.id, req, res);
    res.status(201).json({ user: session });
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({ email: z.string().email().toLowerCase().trim(), password: z.string().min(1) });

authRouter.post("/login", validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) throw unauthorized("Invalid email or password");
    const session = await issueSession(user.id, req, res);
    res.json({ user: session });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[config.cookies.refresh] as string | undefined;
    if (!token) throw unauthorized("No refresh token");
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      if (stored && !stored.revokedAt && stored.expiresAt > new Date()) {
        // Reuse detection is handled via revokedAt; expired tokens are just rejected.
      }
      throw unauthorized("Session expired");
    }
    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const session = await issueSession(stored.userId, req, res, stored.id);
    res.json({ user: session });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[config.cookies.refresh] as string | undefined;
  if (token) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(config.cookies.access, { path: "/" });
  res.clearCookie(config.cookies.refresh, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw unauthorized();
    res.json({ user });
  } catch (e) {
    next(e);
  }
});
