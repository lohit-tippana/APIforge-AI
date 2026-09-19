"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List className={cn("flex items-center gap-0.5 border-b border-border", className)}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative px-3 pb-2 pt-1.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg outline-none",
        "data-[state=active]:text-fg",
        "after:absolute after:inset-x-2 after:-bottom-px after:h-px after:bg-transparent",
        "data-[state=active]:after:bg-accent",
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}
