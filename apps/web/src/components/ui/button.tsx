"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "default" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
}

const variants = {
  primary:
    "bg-accent text-accent-fg font-medium hover:bg-accent-strong active:brightness-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
  default:
    "bg-surface-3 text-fg border border-border-strong hover:bg-overlay hover:border-[#3b4048] active:bg-surface-3",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-3 active:bg-overlay",
  danger: "text-danger hover:bg-danger-dim border border-transparent",
  outline: "border border-border bg-transparent text-fg-muted hover:text-fg hover:border-border-strong",
};

const sizes = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-[var(--radius-sm)]",
  md: "h-8 px-3.5 text-[13px] gap-2 rounded-[var(--radius-sm)]",
  icon: "h-7 w-7 rounded-[var(--radius-sm)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors select-none",
        "disabled:pointer-events-none disabled:opacity-45 cursor-pointer",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
