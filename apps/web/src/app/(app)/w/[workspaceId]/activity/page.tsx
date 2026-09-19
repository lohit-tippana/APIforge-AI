"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon } from "lucide-react";
import { get } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/types";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";

export default function ActivityPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ["activity", workspaceId],
    queryFn: () => get<{ activity: ActivityEntry[] }>(`/workspaces/${workspaceId}/activity`).then((r) => r.activity),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-[16px] font-semibold">Activity</h1>
        <p className="mt-0.5 text-[12.5px] text-fg-muted">Audit trail for this workspace.</p>

        <div className="mt-5">
          {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mb-2 h-10" />)}
          {data?.length === 0 && <EmptyState icon={<ActivityIcon size={22} />} title="No activity yet" />}
          {data?.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0">
              <Avatar name={a.user.name} src={a.user.avatarUrl} size={24} />
              <p className="flex-1 text-[13px] text-fg-muted">
                <span className="font-medium text-fg">{a.user.name}</span>{" "}
                {a.action}{" "}
                <span className="text-fg-faint">{a.entityType}</span>{" "}
                {a.entityName && <span className="font-medium text-fg">“{a.entityName}”</span>}
              </p>
              <span className="text-[11px] text-fg-faint">{timeAgo(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
