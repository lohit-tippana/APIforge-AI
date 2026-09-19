"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { KvRow } from "@/lib/types";
import { KvEditor } from "./kv-editor";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

const BODY_TYPES = [
  { id: "NONE", label: "none" },
  { id: "JSON", label: "JSON" },
  { id: "FORM", label: "form-data" },
  { id: "URLENCODED", label: "x-www-form-urlencoded" },
  { id: "RAW", label: "raw" },
];

export function BodyEditor({
  bodyType,
  body,
  onChange,
}: {
  bodyType: string;
  body: string;
  onChange: (patch: { bodyType?: string; body?: string }) => void;
}) {
  const formRows: KvRow[] = (() => {
    if (bodyType !== "FORM" && bodyType !== "URLENCODED") return [{ key: "", value: "", enabled: true }];
    try {
      const p = JSON.parse(body || "[]");
      return Array.isArray(p) ? p : [{ key: "", value: "", enabled: true }];
    } catch {
      return [{ key: "", value: "", enabled: true }];
    }
  })();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        {BODY_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange({ bodyType: t.id, body: t.id === "FORM" || t.id === "URLENCODED" ? "[]" : body })}
            className={cn(
              "rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] transition-colors",
              bodyType === t.id ? "bg-surface-3 text-fg font-medium" : "text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {bodyType === "NONE" && (
          <p className="px-4 py-8 text-center text-[12.5px] text-fg-faint">This request does not have a body.</p>
        )}
        {(bodyType === "JSON" || bodyType === "RAW") && (
          <CodeMirror
            value={body}
            height="100%"
            className="h-full text-[12.5px]"
            theme="dark"
            onChange={(v: string) => onChange({ body: v })}
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
            placeholder={bodyType === "JSON" ? '{ "key": "value" }' : "Raw request body"}
          />
        )}
        {(bodyType === "FORM" || bodyType === "URLENCODED") && (
          <KvEditor
            rows={formRows}
            onChange={(rows) => onChange({ body: JSON.stringify(rows.filter((r) => r.key || r.value)) })}
          />
        )}
      </div>
    </div>
  );
}
