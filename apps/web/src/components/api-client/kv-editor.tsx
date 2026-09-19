"use client";

import { GripVertical, Trash2 } from "lucide-react";
import type { KvRow } from "@/lib/types";
import { cn } from "@/lib/utils";

// Postman-style key/value row editor. Always renders one trailing empty row;
// typing in it appends a new row.
export function KvEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const list = rows.length && (rows[rows.length - 1].key !== "" || rows[rows.length - 1].value !== "")
    ? [...rows, { key: "", value: "", enabled: true }]
    : rows.length
      ? rows
      : [{ key: "", value: "", enabled: true }];

  const update = (i: number, patch: Partial<KvRow>) => {
    const next = list.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  };

  return (
    <div className="text-[12.5px]">
      <div className="grid grid-cols-[24px_20px_1fr_1fr_28px] items-center gap-0 border-b border-border px-1 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">
        <span /><span /><span>{keyPlaceholder}</span><span>{valuePlaceholder}</span><span />
      </div>
      {list.map((row, i) => {
        const isLast = i === list.length - 1 && !row.key && !row.value;
        return (
          <div key={i} className="group grid grid-cols-[24px_20px_1fr_1fr_28px] items-center gap-0 border-b border-border/50 px-1 hover:bg-surface-2/60">
            <span className="flex justify-center text-fg-faint/50"><GripVertical size={11} /></span>
            <input
              type="checkbox"
              checked={row.enabled}
              disabled={isLast}
              onChange={(e) => update(i, { enabled: e.target.checked })}
              className="h-3 w-3 cursor-pointer accent-[#f0a04b]"
              aria-label="Enable row"
            />
            <input
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder={keyPlaceholder}
              spellCheck={false}
              className={cn("h-7 bg-transparent px-2 font-mono text-[12px] text-fg placeholder:text-fg-faint/60 focus:outline-none", !row.enabled && "opacity-40")}
            />
            <input
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder={valuePlaceholder}
              spellCheck={false}
              className={cn("h-7 bg-transparent px-2 font-mono text-[12px] text-fg placeholder:text-fg-faint/60 focus:outline-none", !row.enabled && "opacity-40")}
            />
            <button
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              disabled={isLast}
              className="hidden h-5 w-5 items-center justify-center rounded text-fg-faint hover:bg-danger-dim hover:text-danger group-hover:flex disabled:invisible"
              aria-label="Remove row"
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
