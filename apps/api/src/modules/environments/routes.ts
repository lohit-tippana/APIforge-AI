import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { projectAccess } from "../../middleware/workspace";

export const environmentsRouter = Router();
environmentsRouter.use(requireAuth);

async function projectOfEnvironment(id: string) {
  return (await prisma.environment.findUnique({ where: { id }, select: { projectId: true } }))?.projectId ?? null;
}

const envAccess = (role: "VIEWER" | "DEVELOPER" | "ADMIN") =>
  projectAccess(role, (req) => projectOfEnvironment(req.params.id));

// Secret values never leave the API — the executor resolves them from the
// database at send time, and PUT /variables preserves a stored secret when
// the client submits an empty value for it.
function maskVariables<T extends { isSecret: boolean; value: string }>(vars: T[]) {
  return vars.map((v) => (v.isSecret ? { ...v, value: "" } : v));
}

environmentsRouter.get("/:id", envAccess("VIEWER"), async (req, res, next) => {
  try {
    const env = await prisma.environment.findUnique({
      where: { id: req.params.id },
      include: { variables: { orderBy: { sortOrder: "asc" } } },
    });
    if (!env) throw notFound();
    res.json({ environment: { ...env, variables: maskVariables(env.variables) } });
  } catch (e) {
    next(e);
  }
});

const envCreate = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120).trim(),
});

environmentsRouter.post("/", validate({ body: envCreate }), async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) =>
      projectAccess("DEVELOPER", async () => req.body.projectId)(req, res, (e) => (e ? reject(e) : resolve())),
    );
    const environment = await prisma.environment.create({
      data: { projectId: req.body.projectId, name: req.body.name },
      include: { variables: true },
    });
    res.status(201).json({ environment });
  } catch (e) {
    next(e);
  }
});

environmentsRouter.patch("/:id", envAccess("DEVELOPER"), async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(120).trim().optional(), isDefault: z.boolean().optional() });
    const data = schema.parse(req.body);
    const environment = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.environment.updateMany({ where: { projectId: req.params.projectId }, data: { isDefault: false } });
      }
      return tx.environment.update({ where: { id: req.params.id }, data });
    });
    res.json({ environment });
  } catch (e) {
    next(e);
  }
});

environmentsRouter.delete("/:id", envAccess("DEVELOPER"), async (req, res, next) => {
  try {
    await prisma.environment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Replace all variables atomically (what the UI editor submits).
const varsSchema = z.object({
  variables: z.array(
    z.object({
      key: z.string().min(1).max(160),
      value: z.string().max(4000).default(""),
      isSecret: z.boolean().default(false),
      enabled: z.boolean().default(true),
    }),
  ),
});

environmentsRouter.put("/:id/variables", envAccess("DEVELOPER"), validate({ body: varsSchema }), async (req, res, next) => {
  try {
    const env = await prisma.environment.findUnique({ where: { id: req.params.id }, include: { variables: true } });
    if (!env) throw notFound();
    const existing = new Map(env.variables.map((v) => [v.key, v]));
    const rows = req.body.variables as { key: string; value: string; isSecret: boolean; enabled: boolean }[];
    await prisma.$transaction(async (tx) => {
      await tx.environmentVariable.deleteMany({ where: { environmentId: env.id } });
      await tx.environmentVariable.createMany({
        data: rows
          .filter((r) => r.key.trim())
          .map((r, i) => ({
            environmentId: env.id,
            key: r.key,
            // Empty value on an existing secret = keep the stored value.
            value: r.isSecret && r.value === "" && existing.has(r.key) ? existing.get(r.key)!.value : r.value,
            isSecret: r.isSecret,
            enabled: r.enabled,
            sortOrder: i,
          })),
      });
    });
    await logActivity({
      workspaceId: req.params.workspaceId,
      projectId: req.params.projectId,
      userId: req.user!.id,
      action: "updated",
      entityType: "environment",
      entityId: env.id,
      entityName: env.name,
    });
    const updated = await prisma.environment.findUnique({
      where: { id: env.id },
      include: { variables: { orderBy: { sortOrder: "asc" } } },
    });
    res.json({ environment: updated });
  } catch (e) {
    next(e);
  }
});
