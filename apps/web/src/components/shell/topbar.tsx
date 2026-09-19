"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Bell, Check, ChevronDown, Globe, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useProject, useWorkspace } from "@/lib/hooks";
import { useWorkspaceStore } from "@/lib/store";
import type { Notification } from "@/lib/types";
import { Badge, Kbd } from "@/components/ui/misc";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { PopoverRoot, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Breadcrumbs() {
  const params = useParams<{ workspaceId: string; projectId?: string }>();
  const pathname = usePathname();
  const { data: workspace } = useWorkspace(params.workspaceId);
  const { data: project } = useProject(params.projectId);
  const section = pathname.split("/").filter(Boolean).pop();

  return (
    <nav className="flex items-center gap-1.5 text-[12.5px] text-fg-muted min-w-0">
      <Link href={`/w/${params.workspaceId}`} className="truncate hover:text-fg transition-colors">{workspace?.name ?? "…"}</Link>
      {project && (
        <>
          <span className="text-fg-faint">/</span>
          <Link href={`/w/${params.workspaceId}/p/${project.id}/collections`} className="truncate hover:text-fg transition-colors">{project.name}</Link>
        </>
      )}
      {section && !["w", "p"].includes(section) && section !== params.workspaceId && section !== params.projectId && (
        <>
          <span className="text-fg-faint">/</span>
          <span className="text-fg capitalize">{section.replace(/-/g, " ")}</span>
        </>
      )}
    </nav>
  );
}

function EnvSelector() {
  const params = useParams<{ projectId?: string }>();
  const { data: project } = useProject(params.projectId);
  const activeId = useWorkspaceStore((s) => s.activeEnvironmentId);
  const setActive = useWorkspaceStore((s) => s.setActiveEnvironment);

  if (!project?.environments?.length) return null;
  const active = project.environments.find((e) => e.id === activeId) ?? project.environments.find((e) => e.isDefault) ?? project.environments[0];
  if (!activeId && active) setActive(active.id);

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2.5 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg transition-colors">
          <Globe size={13} className="text-accent" />
          <span className="max-w-32 truncate">{active.name}</span>
          <ChevronDown size={12} className="text-fg-faint" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownLabel>Environment</DropdownLabel>
        {project.environments.map((env) => (
          <DropdownItem key={env.id} onSelect={() => setActive(env.id)}>
            <span className="flex-1 truncate">{env.name}</span>
            {env.id === active.id && <Check size={13} className="text-accent" />}
          </DropdownItem>
        ))}
        <DropdownItem onSelect={() => setActive(null)}>
          <span className="flex-1 text-fg-faint">No environment</span>
          {!activeId && <Check size={13} className="text-accent" />}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => get<{ notifications: Notification[]; unreadCount: number }>("/notifications"),
    refetchInterval: 30_000,
  });
  const markAll = useMutation({
    mutationFn: () => post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unreadCount ?? 0;
  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <button className="relative flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors">
          <Bell size={15} />
          {unread > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[12.5px] font-medium">Notifications</span>
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} className="text-[11.5px] text-fg-faint hover:text-fg">Mark all read</button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(data?.notifications ?? []).length === 0 && (
            <p className="px-3 py-8 text-center text-[12.5px] text-fg-faint">No notifications yet</p>
          )}
          {(data?.notifications ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => !n.readAt && markRead.mutate(n.id)}
              className={cn("flex w-full gap-2.5 border-b border-border/50 px-3 py-2.5 text-left hover:bg-surface-3/50", !n.readAt && "bg-accent-dim/40")}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-fg leading-snug">{n.title}</p>
                {n.body && <p className="mt-0.5 text-[11.5px] text-fg-muted leading-snug">{n.body}</p>}
                <p className="mt-1 text-[10.5px] text-fg-faint">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <Breadcrumbs />
      <div className="flex-1" />
      <button
        onClick={onOpenPalette}
        className="flex h-7 w-56 items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2.5 text-[12px] text-fg-faint hover:border-border-strong hover:text-fg-muted transition-colors"
      >
        <Search size={13} />
        <span className="flex-1 text-left">Search or command…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <EnvSelector />
      <Notifications />
    </header>
  );
}
