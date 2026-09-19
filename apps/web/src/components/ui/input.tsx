"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full bg-surface-2 border border-border rounded-[var(--radius-sm)] px-2.5 text-[13px] text-fg placeholder:text-fg-faint transition-colors hover:border-border-strong focus:border-accent/50 focus:bg-surface-2 focus:outline-none disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClass, "h-8", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClass, "py-2 min-h-20 resize-y", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-fg-faint">{hint}</span>}
    </label>
  );
}
