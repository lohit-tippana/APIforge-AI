"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Assertion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TYPES = [
  { id: "STATUS", label: "Status code", target: false, expected: "200" },
  { id: "RESPONSE_TIME", label: "Response time (ms)", target: false, expected: "500" },
  { id: "JSON_EXISTS", label: "JSON field exists", target: true, expected: null },
  { id: "JSON_EQUALS", label: "JSON field equals", target: true, expected: "" },
  { id: "JSON_TYPE", label: "JSON field type", target: true, expected: "string" },
  { id: "HEADER_EXISTS", label: "Header exists", target: true, expected: null },
  { id: "HEADER_EQUALS", label: "Header equals", target: true, expected: "" },
  { id: "BODY_CONTAINS", label: "Body contains", target: false, expected: "" },
  { id: "SCHEMA", label: "JSON schema", target: false, expected: '{"type":"object"}' },
];

const OPERATORS = ["EQ", "NEQ", "LT", "LTE", "GT", "GTE", "CONTAINS"];
const NUMERIC_OPS = new Set(["STATUS", "RESPONSE_TIME"]);

export function AssertionsEditor({ assertions, onChange }: { assertions: Assertion[]; onChange: (a: Assertion[]) => void }) {
  const update = (i: number, patch: Partial<Assertion>) => onChange(assertions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const meta = (t: string) => TYPES.find((x) => x.id === t) ?? TYPES[0];

  return (
    <div className="p-3 text-[12.5px]">
      <div className="grid grid-cols-[20px_170px_1fr_80px_1fr_28px] items-center gap-2 border-b border-border pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">
        <span /><span>Type</span><span>Target</span><span>Operator</span><span>Expected</span><span />
      </div>
      {assertions.map((a, i) => {
        const m = meta(a.type);
        return (
          <div key={i} className="group grid grid-cols-[20px_170px_1fr_80px_1fr_28px] items-center gap-2 border-b border-border/50 py-1">
            <input type="checkbox" checked={a.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} className="h-3 w-3 cursor-pointer accent-[#f0a04b]" />
            <select
              value={a.type}
              onChange={(e) => update(i, { type: e.target.value, operator: NUMERIC_OPS.has(e.target.value) ? "EQ" : a.operator })}
              className="h-7 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-1.5 text-[12px] text-fg focus:border-accent/50 focus:outline-none"
            >
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input
              value={a.target ?? ""}
              disabled={!m.target}
              onChange={(e) => update(i, { target: e.target.value })}
              placeholder={m.target ? (a.type.startsWith("HEADER") ? "content-type" : "data.id") : "—"}
              spellCheck={false}
              className={cn("h-7 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-2 font-mono text-[12px] text-fg placeholder:text-fg-faint/50 focus:border-accent/50 focus:outline-none disabled:opacity-30")}
            />
            {NUMERIC_OPS.has(a.type) ? (
              <select
                value={a.operator ?? "EQ"}
                onChange={(e) => update(i, { operator: e.target.value })}
                className="h-7 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-1 text-[12px] text-fg focus:border-accent/50 focus:outline-none"
              >
                {OPERATORS.slice(0, 6).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : a.type === "HEADER_EQUALS" ? (
              <select
                value={a.operator ?? "EQ"}
                onChange={(e) => update(i, { operator: e.target.value })}
                className="h-7 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-1 text-[12px] text-fg focus:border-accent/50 focus:outline-none"
              >
                {["EQ", "CONTAINS"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : <span className="text-center text-fg-faint">—</span>}
            <input
              value={a.expected ?? ""}
              disabled={m.expected === null}
              onChange={(e) => update(i, { expected: e.target.value })}
              placeholder={m.expected ?? ""}
              spellCheck={false}
              className="h-7 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-2 font-mono text-[12px] text-fg placeholder:text-fg-faint/50 focus:border-accent/50 focus:outline-none disabled:opacity-30"
            />
            <button onClick={() => onChange(assertions.filter((_, j) => j !== i))} className="hidden h-5 w-5 items-center justify-center rounded text-fg-faint hover:bg-danger-dim hover:text-danger group-hover:flex" aria-label="Remove assertion">
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        className="mt-2.5"
        onClick={() => onChange([...assertions, { type: "STATUS", operator: "EQ", expected: "200", enabled: true }])}
      >
        <Plus size={13} /> Add assertion
      </Button>
    </div>
  );
}
