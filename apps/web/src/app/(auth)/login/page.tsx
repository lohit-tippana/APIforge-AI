"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Zap } from "lucide-react";
import { post } from "@/lib/api";
import { useWorkspaces } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 sm:px-12 lg:w-[480px] lg:shrink-0">
        <Link href="/" className="mb-10 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-fg">
            <Zap size={15} strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">APIForge</span>
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[13px] text-fg-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
      <div className="hidden flex-1 border-l border-border bg-surface lg:flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.35]" style={{
          backgroundImage: "radial-gradient(circle at 70% 30%, #f0a04b12 0%, transparent 50%), linear-gradient(#ffffff05 1px, transparent 1px), linear-gradient(90deg, #ffffff05 1px, transparent 1px)",
          backgroundSize: "auto, 44px 44px, 44px 44px",
        }} />
        <div className="relative max-w-sm px-8">
          <p className="font-mono text-[12px] text-accent">$ apiforge run products</p>
          <pre className="mt-4 rounded-[var(--radius-md)] border border-border bg-bg/80 p-4 font-mono text-[11.5px] leading-relaxed text-fg-muted">
{`GET  /products        200   184ms
POST /auth/login      200   241ms
GET  /carts/1         200   156ms
────────────────────────────
3 passed · 0 failed · 581ms`}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { refetch } = useWorkspaces();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await post("/auth/login", { email, password });
      const res = await refetch();
      const workspaces = res.data ?? [];
      router.push(workspaces.length ? `/w/${workspaces[0].id}` : "/onboarding");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your APIForge workspace">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </Field>
        {error && <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-dim px-3 py-2 text-[12.5px] text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="w-full h-9" disabled={loading}>
          {loading ? <Spinner size={14} /> : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[12.5px] text-fg-muted">
        New to APIForge?{" "}
        <Link href="/register" className="text-accent hover:text-accent-strong">Create an account</Link>
      </p>
      <p className="mt-3 text-center text-[11.5px] text-fg-faint">Demo: demo@apiforge.dev · demo1234</p>
    </AuthShell>
  );
}
