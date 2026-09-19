"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, ArrowRight, Boxes, FolderGit2, Users } from "lucide-react";
import { get } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { useWorkspace } from "@/lib/hooks";
import type { ActivityEntry } from "@/lib/types";
import { Avatar, Skeleton } from "@/components/ui/misc";

export default function WorkspaceOverview({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const { data: activity } = useQuery({
    queryKey: ["activity", workspaceId],
    queryFn: () => get<{ activity: ActivityEntry[] }>(`/workspaces/${workspaceId}/activity`).then((r) => r.activity),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {isLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-accent-dim text-[18px] font-semibold text-accent">
                {workspace?.icon ?? workspace?.name?.[0]}
              </span>
              <div>
                <h1 className="text-[20px] font-semibold tracking-tight">{workspace?.name}</h1>
                <p className="text-[12.5px] text-fg-muted">{workspace?.memberCount ?? workspace?.members?.length} members · {workspace?.projects?.length} projects</p>
              </div>
            </div>

            <h2 className="mb-3 mt-8 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-fg-faint"><FolderGit2 size={13} /> Projects</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(workspace?.projects ?? []).map((p) => (
                <Link
                  key={p.id}
                  href={`/w/${workspaceId}/p/${p.id}/collections`}
                  className="group rounded-[var(--radius-md)] border border-border bg-surface-2 p-4 transition-colors hover:border-border-strong hover:bg-surface-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13.5px] font-semibold text-fg">{p.name}</p>
                    <ArrowRight size={14} className="text-fg-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {p.description && <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">{p.description}</p>}
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-fg-faint"><Boxes size={11} /> {p.collections?.length ?? ""} collections</p>
                </Link>
              ))}
              {(workspace?.projects?.length ?? 0) === 0 && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong p-6 text-center text-[12.5px] text-fg-faint sm:col-span-2">
                  No projects yet — create one from the sidebar.
                </div>
              )}
            </div>

            <h2 className="mb-3 mt-8 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-fg-faint"><ActivityIcon size={13} /> Recent activity</h2>
            <div className="rounded-[var(--radius-md)] border border-border">
              {(activity ?? []).slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-0">
                  <Avatar name={a.user.name} src={a.user.avatarUrl} size={22} />
                  <p className="flex-1 text-[12.5px] text-fg-muted">
                    <span className="text-fg">{a.user.name}</span> {a.action} <span className="text-fg">{a.entityName ?? a.entityType}</span>
                  </p>
                  <span className="text-[11px] text-fg-faint">{timeAgo(a.createdAt)}</span>
                </div>
              ))}
              {activity?.length === 0 && <p className="px-4 py-8 text-center text-[12.5px] text-fg-faint">No activity yet</p>}
            </div>

            <h2 className="mb-3 mt-8 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-fg-faint"><Users size={13} /> Members</h2>
            <div className="flex flex-wrap gap-2">
              {(workspace?.members ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3">
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={20} />
                  <span className="text-[12px] text-fg">{m.user.name}</span>
                  <span className="text-[10.5px] text-fg-faint">{m.role.toLowerCase()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
