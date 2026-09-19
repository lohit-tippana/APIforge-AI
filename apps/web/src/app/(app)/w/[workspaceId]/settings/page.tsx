"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { del, get, patch, post } from "@/lib/api";
import { useMe, useWorkspace } from "@/lib/hooks";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "sonner";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-border bg-surface-2">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {desc && <p className="mt-0.5 text-[12px] text-fg-muted">{desc}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function SettingsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: workspace } = useWorkspace(workspaceId);

  const [name, setName] = useState("");
  const [wsName, setWsName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => get<{ apiKeys: { id: string; name: string; prefix: string; lastUsedAt?: string; createdAt: string }[] }>("/users/me/api-keys").then((r) => r.apiKeys),
  });

  const saveProfile = useMutation({
    mutationFn: () => patch("/users/me", { name: name || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast.success("Profile updated"); },
    onError: (e) => toast.error(e.message),
  });
  const saveWorkspace = useMutation({
    mutationFn: () => patch(`/workspaces/${workspaceId}`, { name: wsName || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workspace", workspaceId] }); qc.invalidateQueries({ queryKey: ["workspaces"] }); toast.success("Workspace updated"); },
    onError: (e) => toast.error(e.message),
  });
  const changePassword = useMutation({
    mutationFn: () => post("/users/me/password", { currentPassword, newPassword }),
    onSuccess: () => { setCurrentPassword(""); setNewPassword(""); toast.success("Password changed — other sessions revoked"); },
    onError: (e) => toast.error(e.message),
  });
  const createKey = useMutation({
    mutationFn: () => post<{ apiKey: { id: string }; secret: string }>("/users/me/api-keys", { name: keyName }),
    onSuccess: (d) => { setNewKey(d.secret); setKeyName(""); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteKey = useMutation({
    mutationFn: (id: string) => del(`/users/me/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const canEdit = ["OWNER", "ADMIN"].includes(workspace?.role ?? "");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 px-6 py-8">
        <h1 className="text-[16px] font-semibold">Settings</h1>

        <Section title="Profile">
          <div className="flex items-center gap-4">
            <Avatar name={me?.name ?? "?"} src={me?.avatarUrl} size={44} />
            <div className="flex-1">
              <Field label="Display name">
                <Input defaultValue={me?.name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="primary" onClick={() => saveProfile.mutate()} disabled={!name.trim()}>Save</Button>
          </div>
        </Section>

        <Section title="Workspace" desc={canEdit ? undefined : "Requires admin role"}>
          <Field label="Workspace name">
            <Input defaultValue={workspace?.name} onChange={(e) => setWsName(e.target.value)} disabled={!canEdit} />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="primary" onClick={() => saveWorkspace.mutate()} disabled={!canEdit || !wsName.trim()}>Save</Button>
          </div>
        </Section>

        <Section title="API keys" desc="Personal keys for programmatic access — send as `Authorization: Bearer afk_…`.">
          {newKey && (
            <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] border border-success/30 bg-success-dim px-3 py-2">
              <code className="flex-1 truncate font-mono text-[12px] text-success">{newKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }} className="text-success hover:opacity-80"><Copy size={13} /></button>
              <span className="text-[11px] text-success/80">shown once</span>
            </div>
          )}
          {(keys ?? []).map((k) => (
            <div key={k.id} className="flex items-center gap-3 border-b border-border/40 py-2 last:border-0">
              <Key size={13} className="text-fg-faint" />
              <div className="flex-1">
                <p className="text-[12.5px] font-medium text-fg">{k.name}</p>
                <p className="font-mono text-[11px] text-fg-faint">{k.prefix}…{k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · never used"}</p>
              </div>
              <button onClick={() => deleteKey.mutate(k.id)} className="rounded p-1 text-fg-faint hover:text-danger"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="mt-3 flex gap-2">
            <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name (e.g. CI pipeline)" className="flex-1" />
            <Button size="sm" onClick={() => createKey.mutate()} disabled={!keyName.trim()}><Plus size={13} /> Create key</Button>
          </div>
        </Section>

        <Section title="Security" desc="Change your password. All other sessions are revoked on change.">
          <div className="space-y-3">
            <Field label="Current password"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters with a letter and a number"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></Field>
            <div className="flex justify-end">
              <Button size="sm" variant="primary" onClick={() => changePassword.mutate()} disabled={!currentPassword || newPassword.length < 8}>Change password</Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
