"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="animate-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "animate-dialog fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-[var(--radius-md)] border border-border-strong bg-surface shadow-[var(--shadow-pop)]",
          "focus:outline-none max-h-[85vh] flex flex-col",
          className,
        )}
      >
        {(title || description) && (
          <div className="border-b border-border px-5 pb-3.5 pt-4">
            {title && <DialogPrimitive.Title className="text-[14px] font-semibold text-fg">{title}</DialogPrimitive.Title>}
            {description && <DialogPrimitive.Description className="mt-1 text-[12.5px] text-fg-muted">{description}</DialogPrimitive.Description>}
          </div>
        )}
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-[var(--radius-xs)] p-1 text-fg-faint hover:bg-surface-3 hover:text-fg">
          <X size={15} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
