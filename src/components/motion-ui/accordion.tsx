import { AnimatePresence, motion, type Transition } from "motion/react";
import { createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/utils";

type AccordionCtx = {
  expanded: string[];
  toggle: (value: string) => void;
  transition: Transition;
};

const AccordionContext = createContext<AccordionCtx | null>(null);
const ItemContext = createContext<{ value: string; id: string } | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion components must be inside <Accordion>");
  return ctx;
}
function useItem() {
  const ctx = useContext(ItemContext);
  if (!ctx) throw new Error("AccordionTrigger/Content must be inside <AccordionItem>");
  return ctx;
}

export type AccordionProps = {
  children: React.ReactNode;
  className?: string;
  /** Allow several items open at once (filters) or only one (FAQ). */
  type?: "single" | "multiple";
  defaultValue?: string[];
  transition?: Transition;
};

/** Motion-Primitives: Accordion — animated height disclosure groups. */
export function Accordion({
  children,
  className,
  type = "multiple",
  defaultValue = [],
  transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
}: AccordionProps) {
  const [expanded, setExpanded] = useState<string[]>(defaultValue);
  const toggle = (value: string) =>
    setExpanded((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : type === "single"
          ? [value]
          : [...prev, value],
    );
  return (
    <AccordionContext.Provider value={{ expanded, toggle, transition }}>
      <div className={cn("divide-y", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <ItemContext.Provider value={{ value, id }}>
      <div className={cn("py-1", className)}>{children}</div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const { expanded, toggle } = useAccordion();
  const { value, id } = useItem();
  const open = expanded.includes(value);
  return (
    <button
      type="button"
      id={`${id}-trigger`}
      aria-expanded={open}
      aria-controls={`${id}-panel`}
      onClick={() => toggle(value)}
      className={cn("group flex w-full items-center justify-between gap-2 py-2.5 text-left", className)}
      data-state={open ? "open" : "closed"}
    >
      {children}
    </button>
  );
}

export function AccordionContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { expanded, transition } = useAccordion();
  const { value, id } = useItem();
  const open = expanded.includes(value);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          className="overflow-hidden"
        >
          <div className={cn("pb-3", className)}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
