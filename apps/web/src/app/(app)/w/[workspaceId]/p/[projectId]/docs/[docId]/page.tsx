"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Eye, Pencil } from "lucide-react";
import { get, put } from "@/lib/api";
import type { Doc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { toast } from "sonner";

// Shared markdown-lite renderer (headings, code, tables, lists, bold, inline code).
export function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _l, code) => `<pre><code>${code.trimEnd()}</code></pre>`)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_m, head: string, body: string) => {
      const ths = head.split("|").filter(Boolean).map((c) => `<th>${c.trim()}</th>`).join("");
      const rows = body.trim().split("\n").map((r) => `<tr>${r.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`).join("");
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li>))/g, "$1</ul>$2")
    .replace(/(<li>)/g, "<ul><li>")
    .replace(/<\/ul><ul>/g, "")
    .replace(/\n{2,}/g, "<br/>");
}

export default function DocPage({ params }: { params: Promise<{ workspaceId: string; projectId: string; docId: string }> }) {
  const { workspaceId, projectId, docId } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["doc", docId],
    queryFn: () => get<{ doc: Doc }>(`/docs/${docId}`).then((r) => r.doc),
  });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setContent(data.content ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => put(`/docs/${docId}`, { title, content, published: data?.published }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc", docId] });
      qc.invalidateQueries({ queryKey: ["docs", projectId] });
      setEditing(false);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: () => put(`/docs/${docId}`, { published: !data?.published }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doc", docId] }),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
        <Link href={`/w/${workspaceId}/p/${projectId}/docs`} className="flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg">
          <ArrowLeft size={13} /> Docs
        </Link>
        <span className="text-fg-faint">/</span>
        {editing ? (
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 text-[13px] font-medium text-fg focus:border-accent/50 focus:outline-none" />
        ) : (
          <span className="text-[13px] font-medium">{data?.title}</span>
        )}
        {data && <Badge tone={data.source === "MANUAL" ? "default" : "accent"}>{data.source.toLowerCase()}</Badge>}
        <div className="flex-1" />
        {data && (
          <>
            <Button size="sm" variant="outline" onClick={() => togglePublish.mutate()}>
              {data.published ? "Unpublish" : "Publish"}
            </Button>
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending}><Check size={13} /> Save</Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={12} /> Edit</Button>
            )}
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-8" /><Skeleton className="mt-3 h-40" /></div>}
        {data && !editing && (
          <div className="doc-content mx-auto max-w-3xl px-8 py-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content ?? "") }} />
        )}
        {data && editing && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-full w-full resize-none bg-transparent p-6 font-mono text-[12.5px] leading-relaxed text-fg focus:outline-none"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}
