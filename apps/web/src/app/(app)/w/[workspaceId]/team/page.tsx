"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Trash2, UserPlus } from "lucide-react";
import { del, patch, post } from "@/lib/api";
import { useMe, useWorkspace } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";
import { Avatar, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "sonner";

const ROLE_DESC: Record<string, string> = {
  OWNER: "Full control incl. deletion",
  ADMIN: "Manage members & settings",
  DEVELOPER: "Create & edit resources",
  VIEWER: "Read-only access",
};

export default function TeamPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: workspace } = useWorkspace(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("DEVELOPER");

  const { data: invitesData } = useQuery({
    queryKey: ["invites", workspaceId],
    queryFn: () => import("@/lib/api").then((m) => m.get<{ invites: { id: string; email: string; role: string; expiresAt: string }[] }>(`/workspaces/${workspaceId}/invites`)).then((r) => r.invites),
  });

  const invite = useMutation({
    mutationFn: () => post<{ added: boolean; member?: { user: { name: string } }; invite?: { token: string } }>(`/workspaces/${workspaceId}/invites`, { email, role }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["invites", workspaceId] });
      setInviteOpen(false);
      setEmail("");
      if (d.added) toast.success(`${d.member?.user.name} added to the workspace`);
      else toast.info("Invite created — share the link", { description: `${window.location.origin}/invite?token=${d.invite?.token}` });
    },
    onError: (e) => toast.error(e.message),
  });

  const setMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => patch(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
    onError: (e) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => del(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success("Member removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => del(`/workspaces/${workspaceId}/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", workspaceId] }),
  });

  const canManage = ["OWNER", "ADMIN"].includes(workspace?.role ?? "");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-semibold">Team</h1>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">{workspace?.members?.length} members in {workspace?.name}</p>
          </div>
          {canManage && <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={13} /> Invite member</Button>}
        </div>

        <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-border">
          {(workspace?.members ?? []).map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
              <Avatar name={m.user.name} src={m.user.avatarUrl} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{m.user.name} {m.user.id === me?.id && <span className="text-fg-faint">(you)</span>}</p>
                <p className="truncate text-[11.5px] text-fg-faint">{m.user.email}</p>
              </div>
              {canManage && m.role !== "OWNER" && m.user.id !== me?.id ? (
                <select
                  value={m.role}
                  onChange={(e) => setMemberRole.mutate({ userId: m.user.id, role: e.target.value })}
                  className="h-7 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-1.5 text-[11.5px] text-fg-muted focus:outline-none"
                >
                  {["ADMIN", "DEVELOPER", "VIEWER"].map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}
                </select>
              ) : (
                <Badge tone={m.role === "OWNER" ? "accent" : "default"}>{m.role.toLowerCase()}</Badge>
              )}
              {canManage && m.role !== "OWNER" && m.user.id !== me?.id && (
                <button onClick={() => confirm(`Remove ${m.user.name}?`) && removeMember.mutate(m.user.id)} className="rounded p-1 text-fg-faint hover:text-danger">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {(invitesData?.length ?? 0) > 0 && (
          <>
            <h2 className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wider text-fg-faint">Pending invites</h2>
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
              {invitesData!.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-0">
                  <Mail size={14} className="text-fg-faint" />
                  <span className="flex-1 text-[12.5px] text-fg-muted">{inv.email}</span>
                  <Badge>{inv.role.toLowerCase()}</Badge>
                  <span className="text-[11px] text-fg-faint">expires {timeAgo(inv.expiresAt)}</span>
                  <button onClick={() => revoke.mutate(inv.id)} className="rounded p-1 text-fg-faint hover:text-danger"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-7 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
          <p className="text-[12px] font-semibold text-fg">Roles</p>
          <div className="mt-2 space-y-1">
            {Object.entries(ROLE_DESC).map(([r, d]) => (
              <p key={r} className="text-[12px] text-fg-muted"><span className="mr-2 inline-block w-20 font-medium text-fg">{r.toLowerCase()}</span>{d}</p>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent title="Invite member" description="Existing APIForge users join instantly; others get an invite link.">
          <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
            <Field label="Email"><Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" /></Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 text-[13px] text-fg focus:border-accent/50 focus:outline-none">
                <option value="DEVELOPER">Developer — create & edit</option>
                <option value="ADMIN">Admin — manage members</option>
                <option value="VIEWER">Viewer — read only</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={invite.isPending}>Invite</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
