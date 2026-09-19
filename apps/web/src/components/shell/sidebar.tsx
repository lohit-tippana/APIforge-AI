"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Activity, BarChart3, BookOpen, Boxes, ChevronsUpDown, Clock, FlaskConical, FolderGit2,
  Globe, History, LayoutDashboard, LogOut, Plus, Settings, Sparkles, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout, useMe, useWorkspace, useWorkspaces } from "@/lib/hooks";
import { Avatar, Separator, Tooltip } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import {
  Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger,
} from "@/components/ui/dropdown";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useCreateProject, useCreateWorkspace } from "@/lib/hooks";
import { useState } from "react";
import { toast } from "sonner";

function NavItem({ href, icon: Icon, label, active, badge }: { href: string; icon: React.ElementType; label: string; active: boolean; badge?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-7 items-center gap-2.5 rounded-[var(--radius-sm)] px-2 text-[12.5px] transition-colors",
        active ? "bg-surface-3 text-fg font-medium" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon size={15} className={cn("shrink-0", active ? "text-fg" : "text-fg-faint group-hover:text-fg-muted")} />
      <span className="truncate">{label}</span>
      {badge}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">{children}</div>;
}

function CreateProjectDialog({ workspaceId, open, onOpenChange }: { workspaceId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateProject();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New project" description="Projects group collections, environments and tests.">
        <form
          className="space-y-3.5"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { project } = await create.mutateAsync({ workspaceId, name, description: description || undefined });
              onOpenChange(false);
              router.push(`/w/${workspaceId}/p/${project.id}/collections`);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Payments API" /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>Create project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const create = useCreateWorkspace();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New workspace" description="A workspace is home to projects, members and activity.">
        <form
          className="space-y-3.5"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { workspace } = await create.mutateAsync({ name });
              onOpenChange(false);
              router.push(`/w/${workspace.id}`);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Engineering" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>Create workspace</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Sidebar() {
  const params = useParams<{ workspaceId: string; projectId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: workspaces } = useWorkspaces();
  const { data: workspace } = useWorkspace(params.workspaceId);
  const logout = useLogout();
  const [newProject, setNewProject] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);

  const projectId = params.projectId;
  const ws = params.workspaceId;
  const projectBase = projectId ? `/w/${ws}/p/${projectId}` : null;
  const activeProject = workspace?.projects?.find((p) => p.id === projectId);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface">
      {/* Workspace switcher */}
      <div className="p-2">
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left hover:bg-surface-2 transition-colors">
              <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-accent-dim text-[12px] font-semibold text-accent">
                {workspace?.icon ?? workspace?.name?.[0] ?? "…"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{workspace?.name ?? "Loading…"}</span>
              <ChevronsUpDown size={13} className="shrink-0 text-fg-faint" />
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-52">
            <DropdownLabel>Workspaces</DropdownLabel>
            {(workspaces ?? []).map((w) => (
              <DropdownItem key={w.id} onSelect={() => router.push(`/w/${w.id}`)}>
                <span className="flex h-5 w-5 items-center justify-center rounded bg-accent-dim text-[10px] font-semibold text-accent">{w.icon ?? w.name[0]}</span>
                <span className="truncate">{w.name}</span>
                {w.id === ws && <span className="ml-auto text-accent">●</span>}
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem onSelect={() => setNewWorkspace(true)}>
              <Plus size={13} /> New workspace
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <NavItem href={`/w/${ws}`} icon={LayoutDashboard} label="Overview" active={pathname === `/w/${ws}`} />

        <div className="flex items-center justify-between pr-1">
          <SectionLabel>Projects</SectionLabel>
          <Tooltip content="New project">
            <button onClick={() => setNewProject(true)} className="rounded p-0.5 text-fg-faint hover:bg-surface-3 hover:text-fg">
              <Plus size={13} />
            </button>
          </Tooltip>
        </div>
        {(workspace?.projects ?? []).map((p) => {
          const active = p.id === projectId;
          return (
            <div key={p.id}>
              <NavItem href={`/w/${ws}/p/${p.id}/collections`} icon={FolderGit2} label={p.name} active={active && !pathname.includes("/p/")} />
              {active && (
                <div className="mb-1 ml-4 space-y-0.5 border-l border-border pl-2">
                  <NavItem href={`${projectBase}/collections`} icon={Boxes} label="Collections" active={pathname.includes("/collections")} />
                  <NavItem href={`${projectBase}/environments`} icon={Globe} label="Environments" active={pathname.includes("/environments")} />
                  <NavItem href={`${projectBase}/test-runs`} icon={FlaskConical} label="Test runs" active={pathname.includes("/test-runs")} />
                  <NavItem href={`${projectBase}/history`} icon={History} label="History" active={pathname.includes("/history")} />
                  <NavItem href={`${projectBase}/docs`} icon={BookOpen} label="Documentation" active={pathname.includes("/docs")} />
                  <NavItem href={`${projectBase}/analytics`} icon={BarChart3} label="Analytics" active={pathname.includes("/analytics")} />
                </div>
              )}
            </div>
          );
        })}
        {workspace && workspace.projects?.length === 0 && (
          <button
            onClick={() => setNewProject(true)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-dashed border-border-strong px-3 py-2 text-[12px] text-fg-faint hover:border-accent/50 hover:text-fg-muted transition-colors"
          >
            + Create your first project
          </button>
        )}

        <SectionLabel>Workspace</SectionLabel>
        <NavItem href={`/w/${ws}/team`} icon={Users} label="Team" active={pathname.endsWith("/team")} />
        <NavItem href={`/w/${ws}/activity`} icon={Activity} label="Activity" active={pathname.endsWith("/activity")} />
        <NavItem href={`/w/${ws}/ai`} icon={Sparkles} label="AI Assistant" active={pathname.endsWith("/ai")} />
        <NavItem href={`/w/${ws}/settings`} icon={Settings} label="Settings" active={pathname.endsWith("/settings")} />
      </nav>

      <Separator />
      {/* User */}
      <div className="p-2">
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-surface-2 transition-colors">
              <Avatar name={me?.name ?? "?"} src={me?.avatarUrl} size={22} />
              <span className="min-w-0 flex-1 truncate text-left text-[12.5px] text-fg">{me?.name ?? "…"}</span>
              <ChevronsUpDown size={13} className="text-fg-faint" />
            </button>
          </DropdownTrigger>
          <DropdownContent side="top" className="w-52">
            <DropdownLabel>{me?.email}</DropdownLabel>
            <DropdownItem onSelect={() => router.push(`/w/${ws}/settings`)}>
              <Settings size={13} /> Settings
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => logout.mutate()}>
              <LogOut size={13} /> Sign out
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <CreateProjectDialog workspaceId={ws} open={newProject} onOpenChange={setNewProject} />
      <CreateWorkspaceDialog open={newWorkspace} onOpenChange={setNewWorkspace} />
    </aside>
  );
}
