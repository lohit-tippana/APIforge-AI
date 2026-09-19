"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Zap } from "lucide-react";
import { useCreateProject, useCreateWorkspace, useMe } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const createWorkspace = useCreateWorkspace();
  const createProject = useCreateProject();
  const [step, setStep] = useState(0);
  const [wsName, setWsName] = useState("");
  const [projName, setProjName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);

  const steps = ["Workspace", "Project", "Done"];

  const next = async () => {
    setBusy(true);
    try {
      if (step === 0) {
        const { workspace } = await createWorkspace.mutateAsync({ name: wsName });
        setWorkspaceId(workspace.id);
        setStep(1);
      } else if (step === 1) {
        const { project } = await createProject.mutateAsync({ workspaceId, name: projName });
        setStep(2);
        setTimeout(() => router.push(`/w/${workspaceId}/p/${project.id}/collections`), 900);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-fg"><Zap size={15} strokeWidth={2.5} /></span>
          <span className="text-[15px] font-semibold">APIForge</span>
        </div>

        <div className="mb-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold", i < step ? "bg-success text-bg" : i === step ? "bg-accent text-accent-fg" : "bg-surface-3 text-fg-faint")}>
                {i < step ? <Check size={11} /> : i + 1}
              </span>
              <span className={cn("text-[12px]", i === step ? "text-fg" : "text-fg-faint")}>{s}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight">Welcome{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
            <p className="mt-1.5 text-[13px] text-fg-muted">Create a workspace — it holds your projects, collections and team.</p>
            <div className="mt-7">
              <Field label="Workspace name"><Input autoFocus value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Acme Engineering" /></Field>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight">Create your first project</h1>
            <p className="mt-1.5 text-[13px] text-fg-muted">Projects contain collections, environments, tests and docs.</p>
            <div className="mt-7">
              <Field label="Project name"><Input autoFocus value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Payments API" /></Field>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight">You're all set</h1>
            <p className="mt-1.5 text-[13px] text-fg-muted">Opening your project — add a collection and send your first request.</p>
          </>
        )}

        {step < 2 && (
          <Button variant="primary" className="mt-7 h-9 px-5" onClick={next} disabled={busy || (step === 0 ? !wsName.trim() : !projName.trim())}>
            Continue <ArrowRight size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
