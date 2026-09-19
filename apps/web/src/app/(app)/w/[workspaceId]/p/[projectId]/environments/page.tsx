"use client";

import { use, useState } from "react";
import { Check, Eye, EyeOff, Globe, Lock, Plus, Star, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { del, patch, post, put } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/hooks";
import type { Environment, EnvVariable } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, Tooltip } from "@/components/ui/misc";
import { toast } from "sonner";

export default function EnvironmentsPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useProject(projectId);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["project", projectId] });

  const envs = project?.environments ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = envs.find((e) => e.id === activeId) ?? envs.find((e) => e.isDefault) ?? envs[0];

  const createEnv = useMutation({
    mutationFn: (name: string) => post("/environments", { projectId, name }),
    onSuccess: () => invalidate(),
  });
  const deleteEnv = useMutation({
    mutationFn: (id: string) => del(`/environments/${id}`),
    onSuccess: () => invalidate(),
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => patch(`/environments/${id}`, { isDefault: true }),
    onSuccess: () => invalidate(),
  });
  const saveVars = useMutation({
    mutationFn: async (variables: EnvVariable[]) => {
      await put(`/environments/${active!.id}/variables`, {
        variables: variables.filter((r) => r.key.trim()).map((r) => ({ key: r.key, value: r.value, isSecret: r.isSecret, enabled: r.enabled })),
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Environment saved");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-full">
      {/* Env list */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[12px] font-semibold text-fg">Environments</span>
          <Button size="icon" variant="ghost" onClick={async () => {
            const name = window.prompt("Environment name");
            if (name) await createEnv.mutateAsync(name);
          }}><Plus size={14} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {envs.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveId(e.id)}
              onKeyDown={(ev) => ev.key === "Enter" && setActiveId(e.id)}
              className={cn(
                "group flex h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 text-[12.5px]",
                active?.id === e.id ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Globe size={13} className={active?.id === e.id ? "text-accent" : "text-fg-faint"} />
              <span className="flex-1 truncate">{e.name}</span>
              {e.isDefault && <Star size={11} className="fill-accent text-accent" />}
              <div className="hidden items-center group-hover:flex">
                {!e.isDefault && (
                  <Tooltip content="Set as default">
                    <button onClick={(ev) => { ev.stopPropagation(); setDefault.mutate(e.id); }} className="rounded p-0.5 hover:text-accent"><Star size={11} /></button>
                  </Tooltip>
                )}
                <Tooltip content="Delete">
                  <button onClick={(ev) => { ev.stopPropagation(); if (confirm(`Delete "${e.name}"?`)) deleteEnv.mutate(e.id); }} className="rounded p-0.5 hover:text-danger"><Trash2 size={11} /></button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Variables editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <VariablesEditor key={active.id} env={active} onSave={(vars) => saveVars.mutate(vars)} saving={saveVars.isPending} />
        ) : (
          <EmptyState icon={<Globe size={22} />} title="No environments" description="Create Development, Staging and Production environments with per-env variables." />
        )}
      </div>
    </div>
  );
}

function VariablesEditor({ env, onSave, saving }: { env: Environment; onSave: (vars: EnvVariable[]) => void; saving: boolean }) {
  const [rows, setRows] = useState<EnvVariable[]>(env.variables);
  const [dirty, setDirty] = useState(false);

  const update = (i: number, patchP: Partial<EnvVariable>) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patchP } : row)));
    setDirty(true);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[14px] font-semibold">{env.name}</h2>
          <p className="text-[11.5px] text-fg-faint">Reference variables as {"{{KEY}}"} in URLs, headers and bodies. Secrets stay server-side.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { onSave(rows); setDirty(false); }} disabled={!dirty || saving}>
          <Check size={13} /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[20px_1fr_1fr_70px_70px_28px] items-center gap-2 border-b border-border px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">
          <span /><span>Variable</span><span>Value</span><span>Secret</span><span>Enabled</span><span />
        </div>
        {rows.map((row, i) => (
          <VarRow key={i} row={row} onChange={(p) => update(i, p)} onRemove={() => { setRows((r) => r.filter((_, j) => j !== i)); setDirty(true); }} />
        ))}
        <div className="px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => { setRows((r) => [...r, { id: `new-${Date.now()}`, key: "", value: "", isSecret: false, enabled: true }]); setDirty(true); }}>
            <Plus size={13} /> Add variable
          </Button>
        </div>
      </div>
    </>
  );
}

function VarRow({ row, onChange, onRemove }: { row: EnvVariable; onChange: (p: Partial<EnvVariable>) => void; onRemove: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="group grid grid-cols-[20px_1fr_1fr_70px_70px_28px] items-center gap-2 border-b border-border/40 px-3 py-1 hover:bg-surface-2/50">
      <input type="checkbox" checked={row.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} className="h-3 w-3 accent-[#f0a04b]" />
      <input
        value={row.key}
        onChange={(e) => onChange({ key: e.target.value.replace(/\s/g, "") })}
        placeholder="BASE_URL"
        spellCheck={false}
        className="h-7 rounded-[var(--radius-xs)] border border-transparent bg-transparent px-2 font-mono text-[12px] text-fg placeholder:text-fg-faint/50 hover:border-border focus:border-accent/50 focus:bg-surface-2 focus:outline-none"
      />
      <div className="relative">
        <input
          type={row.isSecret && !show ? "password" : "text"}
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={row.isSecret ? "••••••••  (leave blank to keep)" : "value"}
          spellCheck={false}
          className="h-7 w-full rounded-[var(--radius-xs)] border border-transparent bg-transparent px-2 pr-6 font-mono text-[12px] text-fg placeholder:text-fg-faint/50 hover:border-border focus:border-accent/50 focus:bg-surface-2 focus:outline-none"
        />
        {row.isSecret && (
          <button onClick={() => setShow(!show)} className="absolute right-1 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg">
            {show ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        )}
      </div>
      <button onClick={() => onChange({ isSecret: !row.isSecret })} className={cn("flex items-center gap-1 text-[11px]", row.isSecret ? "text-warning" : "text-fg-faint hover:text-fg-muted")}>
        <Lock size={10} /> {row.isSecret ? "Secret" : "Plain"}
      </button>
      <span />
      <button onClick={onRemove} className="hidden h-5 w-5 items-center justify-center rounded text-fg-faint hover:bg-danger-dim hover:text-danger group-hover:flex">
        <Trash2 size={11} />
      </button>
    </div>
  );
}
