"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({
  children,
  className,
  align = "start",
  side = "bottom",
  sideOffset = 4,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
}) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "animate-pop z-50 min-w-44 max-h-[70vh] overflow-y-auto rounded-[var(--radius-md)] border border-border-strong bg-surface-2 p-1 shadow-[var(--shadow-pop)]",
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function DropdownItem({
  children,
  className,
  onSelect,
  destructive,
}: {
  children: React.ReactNode;
  className?: string;
  onSelect?: () => void;
  destructive?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12.5px] text-fg outline-none",
        "data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg",
        destructive && "text-danger data-[highlighted]:bg-danger-dim data-[highlighted]:text-danger",
        className,
      )}
    >
      {children}
    </DM.Item>
  );
}

export const DropdownSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const DropdownLabel = ({ children }: { children: React.ReactNode }) => (
  <DM.Label className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-faint">{children}</DM.Label>
);
export const DropdownCheck = ({ checked }: { checked: boolean }) => (
  <span className="ml-auto flex h-4 w-4 items-center justify-center">{checked && <Check size={13} className="text-accent" />}</span>
);
export const DropdownSub = DM.Sub;
export const DropdownSubTrigger = ({ children }: { children: React.ReactNode }) => (
  <DM.SubTrigger className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12.5px] text-fg outline-none data-[highlighted]:bg-surface-3">
    {children}
    <ChevronRight size={13} className="ml-auto text-fg-faint" />
  </DM.SubTrigger>
);
export const DropdownSubContent = ({ children }: { children: React.ReactNode }) => (
  <DM.Portal>
    <DM.SubContent className="animate-pop z-50 min-w-40 rounded-[var(--radius-md)] border border-border-strong bg-surface-2 p-1 shadow-[var(--shadow-pop)]">
      {children}
    </DM.SubContent>
  </DM.Portal>
);
