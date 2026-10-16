import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Off-canvas drawer built on Radix Dialog: focus is trapped inside,
 * Esc and backdrop click close it, and focus returns to the trigger.
 */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const sides = {
  left: "inset-y-0 left-0 h-full w-full max-w-[420px] data-[state=open]:animate-[sheet-in-left_320ms_var(--ease-calm-curve)]",
  right: "inset-y-0 right-0 h-full w-full max-w-[440px] data-[state=open]:animate-[sheet-in-right_320ms_var(--ease-calm-curve)]",
  bottom: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-sm data-[state=open]:animate-[sheet-in-bottom_320ms_var(--ease-calm-curve)]",
  top: "inset-x-0 top-0 max-h-[92dvh] data-[state=open]:animate-[sheet-in-top_280ms_var(--ease-calm-curve)]",
} as const;

function SheetContent({
  side = "right",
  className,
  children,
  title,
  titleExtra,
  description,
  footer,
  hideHeader = false,
  bodyClassName,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof sides;
  title: string;
  /** Rendered next to the title (e.g. item count) */
  titleExtra?: React.ReactNode;
  description?: string;
  /** Sticky footer area */
  footer?: React.ReactNode;
  hideHeader?: boolean;
  bodyClassName?: string;
}) {
  const t = useT("common");
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-[#1a1714]/40 data-[state=open]:animate-[fade-in_300ms_ease-out]" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface text-foreground shadow-pop outline-none",
          sides[side],
          className,
        )}
        {...props}
      >
        {hideHeader ? (
          <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
            <div className="flex items-baseline gap-2">
              <SheetPrimitive.Title className="font-serif text-2xl font-medium">{title}</SheetPrimitive.Title>
              {titleExtra}
            </div>
            <SheetPrimitive.Close
              aria-label={t("closeNamed", { name: title })}
              className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </SheetPrimitive.Close>
          </div>
        )}
        <SheetPrimitive.Description className="sr-only">{description ?? title}</SheetPrimitive.Description>
        <div className={cn("flex-1 overflow-y-auto overscroll-contain", bodyClassName)}>{children}</div>
        {footer && <div className="border-t bg-surface px-5 py-4 sm:px-6">{footer}</div>}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
