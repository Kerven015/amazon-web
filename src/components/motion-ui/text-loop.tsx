import {
  AnimatePresence,
  type AnimatePresenceProps,
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { Children, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TextLoopProps = {
  children: React.ReactNode[];
  className?: string;
  /** Seconds between items */
  interval?: number;
  transition?: Transition;
  variants?: Variants;
  onIndexChange?: (index: number) => void;
  trigger?: boolean;
  mode?: AnimatePresenceProps["mode"];
};

/** Motion-Primitives: Text Loop — cycles through children. Pauses when reduced motion is on. */
export function TextLoop({
  children,
  className,
  interval = 2.5,
  transition = { duration: 0.3 },
  variants,
  onIndexChange,
  trigger = true,
  mode = "popLayout",
}: TextLoopProps) {
  const [index, setIndex] = useState(0);
  const items = Children.toArray(children);
  const reduce = useReducedMotion();
  const active = trigger && !reduce;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = ((current % items.length) + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, active]);

  const defaultVariants: Variants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };

  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      <AnimatePresence mode={mode} initial={false}>
        <motion.span
          key={index}
          className="inline-block"
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          variants={variants ?? defaultVariants}
        >
          {items[index % items.length]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
