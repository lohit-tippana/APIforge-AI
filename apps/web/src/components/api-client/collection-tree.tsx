"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, Copy, FilePlus2, FolderPlus, Folder as FolderIcon, MoreHorizontal, Pencil, Play, Plus, Search, Trash2, Boxes,
} from "lucide-react";
import { cn, METHOD_COLORS } from "@/lib/utils";
import type { ApiRequest, Collection, Folder } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/store";
import { useCreateCollection, useCreateFolder, useDeleteCollection, useDeleteRequest, useRenameCollection } from "@/lib/hooks";
import { post } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, ScrollArea, Tooltip } from "@/components/ui/misc";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "sonner";

interface TreeProps {
  collections: Collection[];
  projectId: string;
  onSelectRequest: (r: ApiRequest) => void;
  onRunCollection: (c: Collection) => void;
}

function CreateCollectionDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const create = useCreateCollection();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New collection" description="Collections group related API requests into folders.">
        <form className="space-y-3.5" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await create.mutateAsync({ projectId, name });
            onOpenChange(false);
            setName("");
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}>
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Authentication" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ open, onOpenChange, initial, onSubmit, title }: { open: boolean; onOpenChange: (v: boolean) => void; initial: string; onSubmit: (name: string) => Promise<void>; title: string }) {
  const [name, setName] = useState(initial);
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) setName(initial); }}>
      <DialogContent title={title}>
        <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); await onSubmit(name); onOpenChange(false); }}>
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewItemDialog({ open, onOpenChange, title, label, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; label: string; onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) setName(""); }}>
      <DialogContent title={title}>
        <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); await onSubmit(name); onOpenChange(false); }}>
          <Field label={label}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionTree({ collections, projectId, onSelectRequest, onRunCollection }: TreeProps) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newCollection, setNewCollection] = useState(false);
  const [rename, setRename] = useState<Collection | null>(null);
  const [newFolderFor, setNewFolderFor] = useState<Collection | null>(null);
  const [newRequestFor, setNewRequestFor] = useState<{ collectionId: string; folderId?: string | null } | null>(null);
  const renameCollection = useRenameCollection();
  const deleteCollection = useDeleteCollection();
  const deleteRequest = useDeleteRequest();
  const createFolder = useCreateFolder();
  const saveRequest = useWorkspaceStore((s) => s.draft.requestId);
  const qc = useQueryClient();

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const filtered = useMemo(() => {
    if (!filter.trim()) return collections;
    const q = filter.toLowerCase();
    return collections
      .map((c) => ({
        ...c,
        requests: (c.requests ?? []).filter((r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.method.toLowerCase() === q),
        folders: c.folders,
      }))
      .filter((c) => c.name.toLowerCase().includes(q) || (c.requests?.length ?? 0) > 0);
  }, [collections, filter]);

  const requestRow = (r: ApiRequest, depth: number) => (
    <div
      key={r.id}
      role="button"
      tabIndex={0}
      onClick={() => onSelectRequest(r)}
      onKeyDown={(e) => e.key === "Enter" && onSelectRequest(r)}
      className={cn(
        "group flex h-[26px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-xs)] pr-1 text-[12.5px] transition-colors",
        saveRequest === r.id ? "bg-accent-dim text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <span className={cn("w-11 shrink-0 font-mono text-[10px] font-semibold", METHOD_COLORS[r.method])}>{r.method}</span>
      <span className="min-w-0 flex-1 truncate">{r.name}</span>
      <Dropdown>
        <DropdownTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="hidden h-5 w-5 items-center justify-center rounded text-fg-faint hover:bg-surface-3 hover:text-fg group-hover:flex"
            aria-label={`Actions for ${r.name}`}
          >
            <MoreHorizontal size={13} />
          </button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={async () => {
            await post(`/requests/${r.id}/duplicate`);
            qc.invalidateQueries({ queryKey: ["project"] });
          }}><Copy size={13} /> Duplicate</DropdownItem>
          <DropdownSeparator />
          <DropdownItem destructive onSelect={async () => {
            await deleteRequest.mutateAsync(r.id);
            toast.success(`Deleted "${r.name}"`);
          }}><Trash2 size={13} /> Delete</DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  );

  const folderNode = (folder: Folder, requests: ApiRequest[], folders: Folder[], depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(folder.id);
    const children = folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const reqs = requests.filter((r) => r.folderId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <div key={folder.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggle(folder.id)}
          onKeyDown={(e) => e.key === "Enter" && toggle(folder.id)}
          className="group flex h-[26px] cursor-pointer items-center gap-1 rounded-[var(--radius-xs)] pr-1 text-[12.5px] text-fg-muted hover:bg-surface-2 hover:text-fg"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {isCollapsed ? <ChevronRight size={12} className="shrink-0 text-fg-faint" /> : <ChevronDown size={12} className="shrink-0 text-fg-faint" />}
          <FolderIcon size={13} className="shrink-0 text-fg-faint" />
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <Dropdown>
            <DropdownTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="hidden h-5 w-5 items-center justify-center rounded text-fg-faint hover:bg-surface-3 hover:text-fg group-hover:flex" aria-label="Folder actions">
                <Plus size={13} />
              </button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={() => setNewRequestFor({ collectionId: folder.collectionId, folderId: folder.id })}>
                <FilePlus2 size={13} /> New request
              </DropdownItem>
              <DropdownItem onSelect={async () => {
                const name = window.prompt("Subfolder name");
                if (name) await createFolder.mutateAsync({ collectionId: folder.collectionId, name, parentId: folder.id });
              }}>
                <FolderPlus size={13} /> New subfolder
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
        {!isCollapsed && (
          <>
            {children.map((f) => folderNode(f, requests, folders, depth + 1))}
            {reqs.map((r) => requestRow(r, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter"
            className="h-7 w-full rounded-[var(--radius-sm)] border border-border bg-surface-2 pl-7 pr-2 text-[12px] text-fg placeholder:text-fg-faint focus:border-accent/50 focus:outline-none"
          />
        </div>
        <Tooltip content="New collection">
          <Button size="icon" variant="ghost" onClick={() => setNewCollection(true)} aria-label="New collection">
            <Plus size={15} />
          </Button>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {filtered.length === 0 && (
            <EmptyState
              icon={<Boxes size={22} />}
              title={filter ? "No matching requests" : "No collections yet"}
              description={filter ? undefined : "Collections organize your API requests into folders."}
              action={!filter && <Button size="sm" onClick={() => setNewCollection(true)}>Create collection</Button>}
            />
          )}
          {filtered.map((c) => {
            const isCollapsed = collapsed.has(c.id);
            const folders = c.folders ?? [];
            const rootFolders = folders.filter((f) => !f.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
            const rootRequests = (c.requests ?? []).filter((r) => !r.folderId).sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <div key={c.id} className="mb-0.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && toggle(c.id)}
                  className="group flex h-7 cursor-pointer items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 text-[12.5px] font-medium text-fg hover:bg-surface-2"
                >
                  {isCollapsed ? <ChevronRight size={12} className="shrink-0 text-fg-faint" /> : <ChevronDown size={12} className="shrink-0 text-fg-faint" />}
                  <Boxes size={13} className="shrink-0 text-accent/80" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="hidden h-5 w-5 items-center justify-center rounded text-fg-faint hover:bg-surface-3 hover:text-fg group-hover:flex" aria-label={`Actions for ${c.name}`}>
                        <MoreHorizontal size={13} />
                      </button>
                    </DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onSelect={() => setNewRequestFor({ collectionId: c.id })}><FilePlus2 size={13} /> New request</DropdownItem>
                      <DropdownItem onSelect={() => setNewFolderFor(c)}><FolderPlus size={13} /> New folder</DropdownItem>
                      <DropdownItem onSelect={() => onRunCollection(c)}><Play size={13} /> Run collection</DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem onSelect={() => setRename(c)}><Pencil size={13} /> Rename</DropdownItem>
                      <DropdownItem destructive onSelect={async () => {
                        if (!window.confirm(`Delete collection "${c.name}" and all its requests?`)) return;
                        await deleteCollection.mutateAsync(c.id);
                        toast.success(`Deleted "${c.name}"`);
                      }}><Trash2 size={13} /> Delete</DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </div>
                {!isCollapsed && (
                  <div>
                    {rootFolders.map((f) => folderNode(f, c.requests ?? [], folders, 1))}
                    {rootRequests.map((r) => requestRow(r, 1))}
                    {rootFolders.length === 0 && rootRequests.length === 0 && (
                      <p className="py-1 pl-9 text-[11.5px] text-fg-faint">Empty — right-click to add</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <CreateCollectionDialog projectId={projectId} open={newCollection} onOpenChange={setNewCollection} />
      <RenameDialog
        open={!!rename}
        onOpenChange={(v) => !v && setRename(null)}
        initial={rename?.name ?? ""}
        title="Rename collection"
        onSubmit={async (name) => { await renameCollection.mutateAsync({ id: rename!.id, name }); }}
      />
      <NewItemDialog
        open={!!newFolderFor}
        onOpenChange={(v) => !v && setNewFolderFor(null)}
        title={`New folder in ${newFolderFor?.name ?? ""}`}
        label="Folder name"
        onSubmit={async (name) => { await createFolder.mutateAsync({ collectionId: newFolderFor!.id, name }); }}
      />
      <NewRequestInline
        target={newRequestFor}
        onClose={() => setNewRequestFor(null)}
        onCreated={onSelectRequest}
      />
    </div>
  );
}

function NewRequestInline({ target, onClose, onCreated }: { target: { collectionId: string; folderId?: string | null } | null; onClose: () => void; onCreated: (r: ApiRequest) => void }) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); else setName(""); }}>
      <DialogContent title="New request">
        <form className="space-y-3.5" onSubmit={async (e) => {
          e.preventDefault();
          const { request } = await post<{ request: ApiRequest }>("/requests", {
            collectionId: target!.collectionId,
            folderId: target!.folderId ?? null,
            name,
            method: "GET",
            url: "{{BASE_URL}}/",
            headers: [],
            params: [],
            assertions: [],
          });
          qc.invalidateQueries({ queryKey: ["project"] });
          onCreated(request);
          onClose();
        }}>
          <Field label="Request name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Get user" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
