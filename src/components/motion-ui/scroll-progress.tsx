import { motion, type SpringOptions, useScroll, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

export type ScrollProgressProps = {
  className?: string;
  springOptions?: SpringOptions;
};

/** Motion-Primitives: Scroll Progress — page reading progress bar. */
export function ScrollProgress({
  className,
  springOptions = { stiffness: 200, damping: 50, restDelta: 0.001 },
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, springOptions);
  return (
    <motion.div
      aria-hidden="true"
      className={cn("fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary", className)}
      style={{ scaleX }}
    />
  );
}
