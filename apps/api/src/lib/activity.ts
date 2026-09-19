import { prisma } from "./prisma";

export async function logActivity(input: {
  workspaceId: string;
  projectId?: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.activityLog
    .create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityName: input.entityName ?? null,
        meta: (input.meta ?? undefined) as never,
      },
    })
    .catch((e) => console.error("[activity] failed:", e));
}

export async function notify(input: {
  userId: string;
  workspaceId?: string | null;
  type: string;
  title: string;
  body?: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.notification
    .create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        meta: (input.meta ?? undefined) as never,
      },
    })
    .catch((e) => console.error("[notify] failed:", e));
}
