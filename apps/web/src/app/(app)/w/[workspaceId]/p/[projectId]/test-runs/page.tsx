"use client";

import { use } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Play, XCircle } from "lucide-react";
import { get } from "@/lib/api";
import { cn, formatDuration, statusColor, timeAgo } from "@/lib/utils";
import type { TestRun } from "@/lib/types";
import { EmptyState, Skeleton } from "@/components/ui/misc";

export default function TestRunsPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["test-runs", params.projectId],
    queryFn: () => get<{ testRuns: TestRun[] }>(`/projects/${params.projectId}/test-runs`).then((r) => r.testRuns),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <h1 className="text-[16px] font-semibold">Test runs</h1>
        <p className="mt-0.5 text-[12.5px] text-fg-muted">Collection run history — run a collection from the Collections page.</p>

        <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-border">
          <div className="grid grid-cols-[1fr_90px_140px_90px_100px] gap-3 border-b border-border bg-surface-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">
            <span>Run</span><span>Status</span><span>Results</span><span>Duration</span><span>When</span>
          </div>
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="m-3 h-9" />)}
          {data?.length === 0 && (
            <EmptyState icon={<FlaskConical size={22} />} title="No test runs yet" description="Open a collection and hit Run collection to execute every request with its assertions." />
          )}
          {data?.map((run) => (
            <Link
              key={run.id}
              href={`/w/${params.workspaceId}/p/${params.projectId}/test-runs/${run.id}`}
              className="grid grid-cols-[1fr_90px_140px_90px_100px] items-center gap-3 border-b border-border/50 px-4 py-2.5 text-[12.5px] hover:bg-surface-2/60 transition-colors"
            >
              <span className="min-w-0 truncate font-medium text-fg">{run.collection?.name ?? run.name}</span>
              <span className={cn("flex items-center gap-1.5 font-medium", run.status === "PASSED" ? "text-success" : run.status === "FAILED" ? "text-danger" : "text-fg-muted")}>
                {run.status === "PASSED" ? <CheckCircle2 size={13} /> : run.status === "FAILED" ? <XCircle size={13} /> : <Play size={13} />}
                {run.status}
              </span>
              <span className="text-fg-muted">
                <span className="text-success">{run.passed}✓</span>{" "}
                <span className="text-danger">{run.failed}✗</span>{" "}
                <span className="text-fg-faint">{run.skipped}⊘</span>
              </span>
              <span className="text-fg-muted">{formatDuration(run.durationMs)}</span>
              <span className="text-fg-faint">{timeAgo(run.createdAt)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
