"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { AuthShell } from "../login/page";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await post("/auth/register", { name, email, password });
      router.push("/onboarding");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start building and testing APIs in minutes">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number">
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>
        {error && <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-dim px-3 py-2 text-[12.5px] text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="w-full h-9" disabled={loading}>
          {loading ? <Spinner size={14} /> : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[12.5px] text-fg-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:text-accent-strong">Sign in</Link>
      </p>
    </AuthShell>
  );
}
