import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { forbidden, notFound } from "../lib/errors";

export const ROLES = { VIEWER: 0, DEVELOPER: 1, ADMIN: 2, OWNER: 3 } as const;
export type Role = keyof typeof ROLES;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      memberRole?: Role;
    }
  }
}

// Resolves :workspaceId (or workspaceId in body/query) to membership and
// enforces a minimum role.
export function requireWorkspaceRole(minRole: Role) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const workspaceId =
        (req.params.workspaceId as string) ??
        (req.body?.workspaceId as string) ??
        (req.query.workspaceId as string);
      if (!workspaceId) throw forbidden("Workspace context required");
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.user!.id } },
      });
      if (!member) throw notFound("Workspace not found");
      if (ROLES[member.role as Role] < ROLES[minRole]) throw forbidden();
      req.memberRole = member.role as Role;
      next();
    } catch (e) {
      next(e);
    }
  };
}

// Enforces a workspace role where the project must be derived from a
// resource lookup (collection/folder/request/environment ids).
export function projectAccess(minRole: Role, resolveProjectId: (req: Request) => Promise<string | null>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const projectId = await resolveProjectId(req);
      if (!projectId) throw notFound("Resource not found");
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw notFound("Project not found");
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.user!.id } },
      });
      if (!member) throw notFound("Project not found");
      if (ROLES[member.role as Role] < ROLES[minRole]) throw forbidden();
      req.memberRole = member.role as Role;
      (req.params as Record<string, string>).workspaceId = project.workspaceId;
      (req.params as Record<string, string>).projectId = project.id;
      next();
    } catch (e) {
      next(e);
    }
  };
}

// Same enforcement but resolves the workspace through a projectId param.
export function requireProjectRole(minRole: Role) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const projectId = (req.params.projectId as string) ?? (req.body?.projectId as string);
      if (!projectId) throw forbidden("Project context required");
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw notFound("Project not found");
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.user!.id } },
      });
      if (!member) throw notFound("Project not found");
      if (ROLES[member.role as Role] < ROLES[minRole]) throw forbidden();
      req.memberRole = member.role as Role;
      (req.params as Record<string, string>).workspaceId = project.workspaceId;
      next();
    } catch (e) {
      next(e);
    }
  };
}
