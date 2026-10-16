import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
};

/** Motion-Primitives: Text Shimmer — animated gradient sweep for loading text. */
export function TextShimmer({ children, className, duration = 1.6, spread = 2 }: TextShimmerProps) {
  const reduce = useReducedMotion();
  const dynamicSpread = children.length * spread;

  if (reduce) {
    return <span className={cn("text-muted-foreground", className)}>{children}</span>;
  }

  return (
    <motion.span
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{ repeat: Infinity, duration, ease: "linear" }}
      style={{
        backgroundImage: `linear-gradient(90deg, transparent calc(50% - ${dynamicSpread}px), var(--foreground), transparent calc(50% + ${dynamicSpread}px)), linear-gradient(var(--muted-foreground), var(--muted-foreground))`,
      }}
    >
      {children}
    </motion.span>
  );
}
