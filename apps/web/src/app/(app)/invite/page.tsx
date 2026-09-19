"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { Zap } from "lucide-react";

function InviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "error" | "done">(() => (params.get("token") ? "loading" : "error"));
  const [message, setMessage] = useState(() => (params.get("token") ? "" : "Missing invite token"));

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;
    post<{ workspace: { id: string; name: string } }>("/invites/accept", { token })
      .then((d) => {
        setState("done");
        setMessage(`You joined ${d.workspace.name}`);
        setTimeout(() => router.push(`/w/${d.workspace.id}`), 1200);
      })
      .catch((e) => {
        setState("error");
        setMessage(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-border bg-surface-2 p-8 text-center">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-fg"><Zap size={17} strokeWidth={2.5} /></span>
      <h1 className="mt-4 text-[17px] font-semibold">Workspace invite</h1>
      {state === "loading" && <div className="mt-5 flex justify-center"><Spinner size={18} className="text-fg-faint" /></div>}
      {state === "done" && <p className="mt-3 text-[13px] text-success">{message} — redirecting…</p>}
      {state === "error" && (
        <>
          <p className="mt-3 text-[13px] text-danger">{message}</p>
          <Button className="mt-5" onClick={() => router.push("/")}>Go home</Button>
        </>
      )}
    </div>
  );
}

export default function InvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={<Spinner size={18} className="text-fg-faint" />}>
        <InviteInner />
      </Suspense>
    </div>
  );
}
