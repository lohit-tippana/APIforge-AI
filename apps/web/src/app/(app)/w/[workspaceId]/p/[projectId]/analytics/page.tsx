"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { get } from "@/lib/api";
import { formatDuration, timeAgo } from "@/lib/utils";
import type { Analytics } from "@/lib/types";
import { Skeleton } from "@/components/ui/misc";

const tooltipStyle = { background: "#1d2026", border: "1px solid #31353d", borderRadius: 6, fontSize: 12, color: "#e8e9ec" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 px-4 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-fg">{value}</p>
      {sub && <p className="text-[11px] text-fg-faint">{sub}</p>}
    </div>
  );
}

const PIE_COLORS: Record<string, string> = { "2xx": "#4ade80", "3xx": "#60a5fa", "4xx": "#fbbf24", "5xx": "#f87171", ERR: "#63676f" };

export default function AnalyticsPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", projectId],
    queryFn: () => get<{ analytics: Analytics }>(`/projects/${projectId}/analytics`).then((r) => r.analytics),
  });
  const a = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="text-[16px] font-semibold">Analytics</h1>
        <p className="mt-0.5 text-[12.5px] text-fg-muted">Request activity over the last 30 days.</p>

        {isLoading && <div className="mt-6 grid grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>}

        {a && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Requests" value={String(a.totalRequests)} sub={`${a.collections} collections · ${a.requests} saved`} />
              <Stat label="Success rate" value={`${a.successRate}%`} sub={`${a.failed} failed`} />
              <Stat label="Avg response" value={a.avgResponseTime ? formatDuration(a.avgResponseTime) : "—"} />
              <Stat label="Test runs" value={String(a.testRuns)} sub={`${a.activeMembers} active member${a.activeMembers === 1 ? "" : "s"}`} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-4 lg:col-span-2">
                <p className="mb-3 text-[12px] font-semibold text-fg">Requests per day</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={a.daily}>
                    <defs>
                      <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f0a04b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f0a04b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#23262d" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#63676f" }} tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#63676f" }} axisLine={false} tickLine={false} width={28} />
                    <RTooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="requests" stroke="#f0a04b" strokeWidth={1.5} fill="url(#gReq)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
                <p className="mb-3 text-[12px] font-semibold text-fg">Status distribution</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={a.statusDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                      {a.statusDistribution.map((s) => <Cell key={s.name} fill={PIE_COLORS[s.name] ?? "#63676f"} />)}
                    </Pie>
                    <RTooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
              <p className="mb-3 text-[12px] font-semibold text-fg">Avg response time (ms/day)</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={a.daily}>
                  <CartesianGrid stroke="#23262d" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#63676f" }} tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#63676f" }} axisLine={false} tickLine={false} width={32} />
                  <RTooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
                  <Bar dataKey="avgTime" fill="#60a5fa" radius={[2, 2, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {a.recentRuns.length > 0 && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
                <p className="mb-2 text-[12px] font-semibold text-fg">Recent test runs</p>
                {a.recentRuns.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 border-t border-border/40 py-2 text-[12.5px] first:border-0">
                    <span className={r.status === "PASSED" ? "text-success" : "text-danger"}>{r.status === "PASSED" ? "●" : "●"}</span>
                    <span className="flex-1 text-fg">{r.collection?.name ?? r.name}</span>
                    <span className="text-fg-muted">{r.passed}/{r.totalRequests} passed</span>
                    <span className="text-fg-faint">{timeAgo(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
