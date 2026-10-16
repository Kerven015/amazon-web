import { motion, type Transition, type UseInViewOptions, useInView, type Variants } from "motion/react";
import { useRef } from "react";

export type InViewProps = {
  children: React.ReactNode;
  variants?: { hidden: Variants[string]; visible: Variants[string] };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  once?: boolean;
  className?: string;
};

const defaultVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/** Motion-Primitives: In View — animates children when they enter the viewport. */
export function InView({
  children,
  variants = defaultVariants,
  transition = { duration: 0.35, ease: "easeOut" },
  viewOptions = { margin: "0px 0px -80px 0px" },
  once = true,
  className,
}: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { ...viewOptions, once });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
