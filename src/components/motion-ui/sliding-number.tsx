import { motion, type MotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const TRANSITION = { stiffness: 280, damping: 18, mass: 0.3 };

function Digit({ value, place }: { value: number; place: number }) {
  const reduce = useReducedMotion();
  const digitValue = Math.floor(value / place) % 10;
  const animated = useSpring(digitValue, TRANSITION);

  useEffect(() => {
    if (reduce) animated.jump(digitValue);
    else animated.set(digitValue);
  }, [animated, digitValue, reduce]);

  return (
    <span className="relative inline-block w-[1ch] overflow-y-clip leading-none tabular-nums">
      <span className="invisible">0</span>
      {Array.from({ length: 10 }, (_, i) => (
        <DigitFace key={i} mv={animated} number={i} />
      ))}
    </span>
  );
}

function DigitFace({ mv, number }: { mv: MotionValue<number>; number: number }) {
  // Offsets are in em so no DOM measurement is needed (line-height is 1).
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset;
    if (offset > 5) memo -= 10;
    return `${memo}em`;
  });
  return (
    <motion.span
      aria-hidden="true"
      style={{ y }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {number}
    </motion.span>
  );
}

export type SlidingNumberProps = {
  value: number;
  padStart?: number;
  className?: string;
};

/** Motion-Primitives: Sliding Number — odometer-style digit transitions (integers). */
export function SlidingNumber({ value, padStart = 0, className }: SlidingNumberProps) {
  const abs = Math.max(0, Math.floor(Math.abs(value)));
  const str = abs.toString().padStart(padStart, "0");
  const places = str.split("").map((_, i) => 10 ** (str.length - i - 1));

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{str}</span>
      <span aria-hidden="true" className="inline-flex">
        {value < 0 && "-"}
        {places.map((place) => (
          <Digit key={`pos-${place}`} value={abs} place={place} />
        ))}
      </span>
    </span>
  );
}
