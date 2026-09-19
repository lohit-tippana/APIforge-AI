"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Search, Trash2 } from "lucide-react";
import { del, get } from "@/lib/api";
import { cn, formatDuration, statusColor, timeAgo } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { toast } from "sonner";

export default function HistoryPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["history", params.projectId],
    queryFn: () => get<{ history: HistoryEntry[] }>(`/projects/${params.projectId}/history`).then((r) => r.history),
  });
  const clear = useMutation({
    mutationFn: () => del(`/projects/${params.projectId}/history`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history", params.projectId] });
      toast.success("History cleared");
    },
  });

  const rows = (data ?? []).filter((h) => !q || h.url.toLowerCase().includes(q.toLowerCase()) || h.method === q.toUpperCase());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-semibold">Request history</h1>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">Every request sent from this project.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-8 w-52 rounded-[var(--radius-sm)] border border-border bg-surface-2 pl-7 pr-2 text-[12.5px] text-fg placeholder:text-fg-faint focus:border-accent/50 focus:outline-none" />
            </div>
            <Button variant="outline" size="sm" onClick={() => confirm("Clear all history?") && clear.mutate()}><Trash2 size={13} /> Clear</Button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-border">
          {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="m-3 h-8" />)}
          {rows.length === 0 && !isLoading && (
            <EmptyState icon={<History size={22} />} title="No requests sent yet" description="Send a request from the Collections page and it will appear here." />
          )}
          {rows.map((h) => (
            <button
              key={h.id}
              onClick={() => h.request?.id && router.push(`/w/${params.workspaceId}/p/${params.projectId}/collections?request=${h.request.id}`)}
              className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-2 text-left hover:bg-surface-2/60 transition-colors"
            >
              <span className={cn("w-12 shrink-0 font-mono text-[11px] font-semibold", `method-${h.method.toLowerCase()}`)}>{h.method}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-muted">{h.url}</span>
              <span className={cn("w-12 text-right font-mono text-[11.5px]", statusColor(h.statusCode))}>{h.statusCode ?? "ERR"}</span>
              <span className="w-16 text-right font-mono text-[11.5px] text-fg-muted">{h.responseTimeMs ? formatDuration(h.responseTimeMs) : "—"}</span>
              <span className="w-20 text-right text-[11px] text-fg-faint">{timeAgo(h.createdAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
