import { motion, type SpringOptions, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  /** Formats the in-flight value. Defaults to rounding to an integer with locale separators. */
  format?: (value: number) => string;
};

const defaultFormat = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * Motion-Primitives: Animated Number — eases between numeric values.
 * The moving digits are hidden from screen readers (they'd hear every frame);
 * a visually hidden copy holds the final value. It isn't a live region — the
 * parent decides whether a change should be announced.
 */
export function AnimatedNumber({
  value,
  className,
  springOptions = { stiffness: 220, damping: 32, mass: 0.6 },
  format = defaultFormat,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, springOptions);
  const display = useTransform(spring, (current) => format(current));

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [spring, value, reduce]);

  return (
    <span className={cn("tabular-nums", className)}>
      <motion.span aria-hidden="true">{display}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
