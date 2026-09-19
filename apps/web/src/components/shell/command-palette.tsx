"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BookOpen, Boxes, FilePlus2, FlaskConical, FolderGit2, Globe, Search, Sparkles, User, Zap,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { get } from "@/lib/api";
import { cn, METHOD_COLORS } from "@/lib/utils";
import { Kbd } from "@/components/ui/misc";

interface SearchResults {
  projects: { id: string; name: string }[];
  collections: { id: string; name: string; projectId: string }[];
  requests: { id: string; name: string; method: string; url: string; projectId: string }[];
  docs: { id: string; title: string; projectId: string }[];
  members: { id: string; name: string; email: string }[];
}

interface Item {
  id: string;
  icon: React.ElementType;
  label: string;
  hint?: string;
  iconClass?: string;
  action: () => void;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const params = useParams<{ workspaceId: string; projectId?: string }>();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 150);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setDebounced("");
      setSelected(0);
    }
  }, [open]);

  const { data } = useQuery({
    queryKey: ["search", params.workspaceId, debounced],
    queryFn: () => get<{ results: SearchResults }>(`/workspaces/${params.workspaceId}/search?q=${encodeURIComponent(debounced)}`).then((r) => r.results),
    enabled: open && debounced.length > 0,
  });

  const items = useMemo<Item[]>(() => {
    const ws = params.workspaceId;
    const pid = params.projectId;
    const list: Item[] = [];

    if (!debounced) {
      if (pid) {
        list.push(
          { id: "cmd-new-req", icon: FilePlus2, label: "Create request", hint: "Command", action: () => router.push(`/w/${ws}/p/${pid}/collections?new=request`) },
          { id: "cmd-new-col", icon: Boxes, label: "Create collection", hint: "Command", action: () => router.push(`/w/${ws}/p/${pid}/collections?new=collection`) },
          { id: "cmd-run", icon: FlaskConical, label: "Run collection tests", hint: "Command", action: () => router.push(`/w/${ws}/p/${pid}/test-runs`) },
        );
      }
      list.push(
        { id: "cmd-ai", icon: Sparkles, label: "Open AI Assistant", hint: "Command", action: () => router.push(`/w/${ws}/ai`) },
        { id: "cmd-env", icon: Globe, label: "Manage environments", hint: "Command", action: () => pid && router.push(`/w/${ws}/p/${pid}/environments`) },
        { id: "cmd-docs", icon: BookOpen, label: "Documentation", hint: "Command", action: () => pid && router.push(`/w/${ws}/p/${pid}/docs`) },
      );
      return list;
    }

    for (const p of data?.projects ?? []) {
      list.push({ id: `p-${p.id}`, icon: FolderGit2, label: p.name, hint: "Project", action: () => router.push(`/w/${ws}/p/${p.id}/collections`) });
    }
    for (const c of data?.collections ?? []) {
      list.push({ id: `c-${c.id}`, icon: Boxes, label: c.name, hint: "Collection", action: () => router.push(`/w/${ws}/p/${c.projectId}/collections`) });
    }
    for (const r of data?.requests ?? []) {
      list.push({
        id: `r-${r.id}`,
        icon: Zap,
        label: r.name,
        hint: r.url,
        iconClass: METHOD_COLORS[r.method],
        action: () => router.push(`/w/${ws}/p/${r.projectId}/collections?request=${r.id}`),
      });
    }
    for (const d of data?.docs ?? []) {
      list.push({ id: `d-${d.id}`, icon: BookOpen, label: d.title, hint: "Doc", action: () => router.push(`/w/${ws}/p/${d.projectId}/docs/${d.id}`) });
    }
    for (const m of data?.members ?? []) {
      list.push({ id: `m-${m.id}`, icon: User, label: m.name, hint: m.email, action: () => router.push(`/w/${ws}/team`) });
    }
    return list;
  }, [debounced, data, params, router]);

  useEffect(() => setSelected(0), [items.length]);

  const run = (item: Item) => {
    onOpenChange(false);
    item.action();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-overlay fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="animate-dialog fixed left-1/2 top-[18vh] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-surface shadow-[var(--shadow-pop)] focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && items[selected]) {
              e.preventDefault();
              run(items[selected]);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search size={15} className="shrink-0 text-fg-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects, requests, docs… or type a command"
              className="h-12 w-full bg-transparent text-[14px] text-fg placeholder:text-fg-faint focus:outline-none"
            />
            <Kbd>esc</Kbd>
          </div>
          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {items.length === 0 && (
              <p className="px-3 py-8 text-center text-[12.5px] text-fg-faint">
                {debounced ? `No results for "${debounced}"` : "No commands available"}
              </p>
            )}
            {items.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setSelected(i)}
                onClick={() => run(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px]",
                  i === selected ? "bg-surface-3 text-fg" : "text-fg-muted",
                )}
              >
                <item.icon size={14} className={cn("shrink-0", item.iconClass ?? "text-fg-faint")} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="max-w-48 truncate text-[11px] text-fg-faint">{item.hint}</span>}
                {i === selected && <ArrowRight size={13} className="shrink-0 text-fg-faint" />}
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
