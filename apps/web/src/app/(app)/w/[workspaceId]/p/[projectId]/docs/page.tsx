"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { del, get, post } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { useProject } from "@/lib/hooks";
import type { Doc } from "@/lib/types";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DocsPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { workspaceId, projectId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const { data, isLoading } = useQuery({
    queryKey: ["docs", projectId],
    queryFn: () => get<{ docs: Doc[] }>(`/projects/${projectId}/docs`).then((r) => r.docs),
  });

  const generate = useMutation({
    mutationFn: (collectionId: string) => post<{ doc: Doc }>(`/docs/generate/${collectionId}`),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["docs", projectId] });
      toast.success("Documentation generated");
      router.push(`/w/${workspaceId}/p/${projectId}/docs/${d.doc.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/docs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docs", projectId] }),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-semibold">Documentation</h1>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">Generate docs from collections, or write your own.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              const { doc } = await post<{ doc: Doc }>("/docs", { projectId, title: "Untitled doc", content: "# Untitled\n\nStart writing…" });
              router.push(`/w/${workspaceId}/p/${projectId}/docs/${doc.id}`);
            }}
          >
            <Plus size={13} /> New doc
          </Button>
        </div>

        {(project?.collections?.length ?? 0) > 0 && (
          <div className="mt-5 rounded-[var(--radius-md)] border border-border bg-surface-2 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Generate from collection</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {project!.collections!.map((c) => (
                <Button key={c.id} size="sm" variant="outline" onClick={() => generate.mutate(c.id)} disabled={generate.isPending}>
                  <Sparkles size={12} className="text-accent" /> {c.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-border">
          {isLoading && [0, 1].map((i) => <Skeleton key={i} className="m-3 h-12" />)}
          {data?.length === 0 && !isLoading && (
            <EmptyState icon={<BookOpen size={22} />} title="No documentation" description="Generate docs from a collection, or create one manually." />
          )}
          {data?.map((d) => (
            <Link
              key={d.id}
              href={`/w/${workspaceId}/p/${projectId}/docs/${d.id}`}
              className="group flex items-center gap-3 border-b border-border/40 px-4 py-3 hover:bg-surface-2/60 transition-colors"
            >
              <FileText size={15} className="shrink-0 text-fg-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{d.title}</p>
                <p className="text-[11.5px] text-fg-faint">Updated {timeAgo(d.updatedAt)}</p>
              </div>
              <Badge tone={d.source === "MANUAL" ? "default" : "accent"}>{d.source.toLowerCase()}</Badge>
              {d.published && <Badge tone="success">published</Badge>}
              <button
                onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${d.title}"?`)) remove.mutate(d.id); }}
                className="hidden rounded p-1 text-fg-faint hover:text-danger group-hover:block"
              >
                <Trash2 size={13} />
              </button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
