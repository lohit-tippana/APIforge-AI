import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { sha256 } from "../lib/crypto";
import { unauthorized } from "../lib/errors";
import { verifyAccessToken, type AccessPayload } from "../lib/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessPayload & { id: string };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.cookies.access] as string | undefined;
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;

    // API key auth: Bearer afk_...
    if (bearer?.startsWith("afk_")) {
      const key = await prisma.apiKey.findUnique({ where: { keyHash: sha256(bearer) }, include: { user: true } });
      if (!key) throw unauthorized("Invalid API key");
      prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      req.user = { id: key.userId, sub: key.userId, email: key.user.email, name: key.user.name };
      return next();
    }

    const access = token ?? bearer;
    if (!access) throw unauthorized();
    const payload = verifyAccessToken(access);
    req.user = { ...payload, id: payload.sub };
    next();
  } catch {
    next(unauthorized("Invalid or expired session"));
  }
}

// Lightweight CSRF mitigation: cookie-auth mutations must carry a custom
// header. Combined with SameSite=Lax cookies this blocks cross-site posts.
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers["x-requested-with"] !== "fetch" && !req.headers.authorization?.startsWith("Bearer afk_")) {
    return res.status(403).json({ error: { code: "CSRF", message: "Missing request header" } });
  }
  next();
}
