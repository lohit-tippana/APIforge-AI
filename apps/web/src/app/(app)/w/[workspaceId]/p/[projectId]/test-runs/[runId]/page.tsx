"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronRight, MinusCircle, XCircle } from "lucide-react";
import { get } from "@/lib/api";
import { cn, formatDuration, statusColor, timeAgo } from "@/lib/utils";
import type { TestResult, TestRun } from "@/lib/types";
import { Skeleton } from "@/components/ui/misc";

function ResultIcon({ status }: { status: string }) {
  if (status === "PASSED") return <CheckCircle2 size={14} className="shrink-0 text-success" />;
  if (status === "FAILED" || status === "ERROR") return <XCircle size={14} className="shrink-0 text-danger" />;
  return <MinusCircle size={14} className="shrink-0 text-fg-faint" />;
}

export default function TestRunDetailPage({ params }: { params: Promise<{ workspaceId: string; projectId: string; runId: string }> }) {
  const { workspaceId, projectId, runId } = use(params);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ["test-run", runId],
    queryFn: () => get<{ testRun: TestRun & { results: TestResult[] } }>(`/test-runs/${runId}`).then((r) => r.testRun),
    refetchInterval: (q) => (q.state.data?.status === "RUNNING" ? 1500 : false),
  });

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <Link href={`/w/${workspaceId}/p/${projectId}/test-runs`} className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg">
          <ArrowLeft size={13} /> Test runs
        </Link>

        {isLoading && <Skeleton className="h-24" />}
        {run && (
          <>
            <div className="flex items-center gap-4 rounded-[var(--radius-md)] border border-border bg-surface-2 px-5 py-4">
              {run.status === "PASSED" ? <CheckCircle2 size={26} className="text-success" /> : run.status === "FAILED" ? <XCircle size={26} className="text-danger" /> : <MinusCircle size={26} className="text-fg-faint" />}
              <div className="flex-1">
                <h1 className="text-[15px] font-semibold">{run.collection?.name ?? run.name}</h1>
                <p className="text-[12px] text-fg-muted">{timeAgo(run.createdAt)}</p>
              </div>
              <div className="flex gap-6 text-center">
                <div><p className="text-[18px] font-semibold text-fg">{run.totalRequests}</p><p className="text-[10.5px] uppercase tracking-wide text-fg-faint">requests</p></div>
                <div><p className="text-[18px] font-semibold text-success">{run.passed}</p><p className="text-[10.5px] uppercase tracking-wide text-fg-faint">passed</p></div>
                <div><p className="text-[18px] font-semibold text-danger">{run.failed}</p><p className="text-[10.5px] uppercase tracking-wide text-fg-faint">failed</p></div>
                <div><p className="text-[18px] font-semibold text-fg">{formatDuration(run.durationMs)}</p><p className="text-[10.5px] uppercase tracking-wide text-fg-faint">duration</p></div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border">
              {run.results.map((r) => (
                <div key={r.id} className="border-b border-border/50 last:border-0">
                  <button onClick={() => toggle(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/60 transition-colors">
                    <ChevronRight size={13} className={cn("shrink-0 text-fg-faint transition-transform", expanded.has(r.id) && "rotate-90")} />
                    <ResultIcon status={r.status} />
                    <span className={cn("w-12 shrink-0 font-mono text-[11px] font-semibold", `method-${r.method.toLowerCase()}`)}>{r.method}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-fg">{r.requestName}</span>
                    {r.statusCode && <span className={cn("font-mono text-[11.5px]", statusColor(r.statusCode))}>{r.statusCode}</span>}
                    {r.responseTimeMs != null && <span className="w-16 text-right font-mono text-[11.5px] text-fg-muted">{formatDuration(r.responseTimeMs)}</span>}
                    <span className="w-20 text-right text-[11.5px] text-fg-muted">{r.passed}✓ {r.failed}✗ {r.skipped}⊘</span>
                  </button>
                  {expanded.has(r.id) && (
                    <div className="border-t border-border/40 bg-surface-2/40 px-11 py-3">
                      {r.error && <p className="mb-2 font-mono text-[12px] text-danger">{r.error}</p>}
                      {(r.assertionLog ?? []).map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-1 font-mono text-[12px]">
                          <ResultIcon status={a.status} />
                          <span className="flex-1 text-fg">{a.description || a.type}</span>
                          {a.actual && <span className="max-w-72 truncate text-fg-faint">actual: {a.actual}</span>}
                          {a.expected && <span className="text-fg-faint">expected: {a.expected}</span>}
                        </div>
                      ))}
                      {!r.assertionLog?.length && !r.error && <p className="text-[12px] text-fg-faint">No assertions configured.</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
