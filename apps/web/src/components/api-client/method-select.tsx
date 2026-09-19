"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn, METHOD_COLORS } from "@/lib/utils";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function MethodSelect({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="flex h-8 w-[104px] shrink-0 items-center justify-between rounded-l-[var(--radius-sm)] border border-r-0 border-border bg-surface-2 px-2.5 font-mono text-[12px] font-semibold hover:border-border-strong transition-colors">
          <span className={METHOD_COLORS[value]}>{value}</span>
          <ChevronDown size={12} className="text-fg-faint" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-32 font-mono">
        {METHODS.map((m) => (
          <DropdownItem key={m} onSelect={() => onChange(m)} className={cn("font-semibold", METHOD_COLORS[m])}>
            <span className="flex-1">{m}</span>
            {m === value && <Check size={13} />}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
