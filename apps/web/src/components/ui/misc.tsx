"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

// ── Tooltip ──
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={5}
          className="animate-pop z-[60] max-w-64 rounded-[var(--radius-sm)] border border-border-strong bg-overlay px-2 py-1 text-[11.5px] text-fg shadow-[var(--shadow-pop)]"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ── Badge ──
export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "success" | "danger" | "warning" | "info" | "accent"; className?: string }) {
  const tones = {
    default: "bg-surface-3 text-fg-muted border-border-strong",
    success: "bg-success-dim text-success border-transparent",
    danger: "bg-danger-dim text-danger border-transparent",
    warning: "bg-warning/15 text-warning border-transparent",
    info: "bg-info-dim text-info border-transparent",
    accent: "bg-accent-dim text-accent border-transparent",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-[var(--radius-xs)] border px-1.5 py-px text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

// ── ScrollArea ──
export function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ScrollAreaPrimitive.Root className={cn("overflow-hidden", className)}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full [&>div]:!block">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex w-2.5 p-px">
        <ScrollAreaPrimitive.Thumb className="flex-1 rounded-full bg-border-strong" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}

// ── Separator ──
export const Separator = ({ orientation = "horizontal", className }: { orientation?: "horizontal" | "vertical"; className?: string }) => (
  <SeparatorPrimitive.Root
    orientation={orientation}
    className={cn(orientation === "horizontal" ? "h-px w-full" : "w-px h-full", "bg-border", className)}
  />
);

// ── Switch ──
export function Switch({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative h-[18px] w-8 cursor-pointer rounded-full bg-surface-3 border border-border-strong transition-colors data-[state=checked]:bg-accent data-[state=checked]:border-accent disabled:opacity-40"
    >
      <SwitchPrimitive.Thumb className="block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[17px] data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  );
}

// ── Avatar ──
export function Avatar({ name, src, size = 24, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <AvatarPrimitive.Root
      className={cn("inline-flex items-center justify-center rounded-full bg-surface-3 border border-border-strong text-fg-muted select-none", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full rounded-full object-cover" />}
      <AvatarPrimitive.Fallback className="font-medium">{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// ── Skeleton ──
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-[var(--radius-sm)] bg-surface-3", className)} />
);

// ── Kbd ──
export const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-xs)] border border-border-strong bg-surface-2 px-1 font-mono text-[10.5px] text-fg-muted">
    {children}
  </kbd>
);

// ── Spinner ──
export const Spinner = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={cn("animate-spin", className)}>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
    <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ── Empty state ──
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-fg-faint">{icon}</div>}
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[12.5px] text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
