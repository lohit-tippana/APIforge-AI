"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";

const AUTH_TYPES = [
  { id: "NONE", label: "No Auth" },
  { id: "BEARER", label: "Bearer Token" },
  { id: "BASIC", label: "Basic Auth" },
  { id: "APIKEY", label: "API Key" },
] as const;

export function AuthEditor({
  authType,
  authConfig,
  onChange,
}: {
  authType: string;
  authConfig: Record<string, unknown>;
  onChange: (authType: string, authConfig: Record<string, unknown>) => void;
}) {
  const cfg = (k: string) => String(authConfig[k] ?? "");
  const set = (k: string, v: string) => onChange(authType, { ...authConfig, [k]: v });
  const active = AUTH_TYPES.find((t) => t.id === authType) ?? AUTH_TYPES[0];

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 py-1.5">
      <span className="text-[12px] text-fg-muted">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="max-w-xl p-3">
      <Row label="Auth type">
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex h-8 w-56 items-center justify-between rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2.5 text-[12.5px] text-fg hover:border-border-strong">
              {active.label}
              <ChevronDown size={12} className="text-fg-faint" />
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-56">
            {AUTH_TYPES.map((t) => (
              <DropdownItem key={t.id} onSelect={() => onChange(t.id, authConfig)} className="justify-between">
                {t.label}
                {t.id === authType && <Check size={13} className="text-accent" />}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      </Row>

      {authType === "BEARER" && (
        <Row label="Token">
          <Input value={cfg("token")} onChange={(e) => set("token", e.target.value)} placeholder="{{TOKEN}}" className="font-mono" />
        </Row>
      )}
      {authType === "BASIC" && (
        <>
          <Row label="Username"><Input value={cfg("username")} onChange={(e) => set("username", e.target.value)} className="font-mono" /></Row>
          <Row label="Password"><Input type="password" value={cfg("password")} onChange={(e) => set("password", e.target.value)} className="font-mono" /></Row>
        </>
      )}
      {authType === "APIKEY" && (
        <>
          <Row label="Key"><Input value={cfg("key")} onChange={(e) => set("key", e.target.value)} placeholder="X-API-Key" className="font-mono" /></Row>
          <Row label="Value"><Input value={cfg("value")} onChange={(e) => set("value", e.target.value)} placeholder="{{API_KEY}}" className="font-mono" /></Row>
          <Row label="Add to">
            <div className="flex gap-1">
              {(["header", "query"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => set("addTo", v)}
                  className={cn(
                    "h-7 rounded-[var(--radius-sm)] border px-3 text-[12px] capitalize transition-colors",
                    (cfg("addTo") || "header") === v ? "border-accent/50 bg-accent-dim text-accent" : "border-border text-fg-muted hover:text-fg",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </Row>
        </>
      )}
      {authType === "NONE" && (
        <p className="py-4 text-[12.5px] text-fg-faint">This request does not use any authorization.</p>
      )}
    </div>
  );
}
