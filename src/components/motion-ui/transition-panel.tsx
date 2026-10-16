import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import { Children } from "react";
import { cn } from "@/lib/utils";

export type TransitionPanelProps = {
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
  transition?: Transition;
  activeIndex: number;
  variants?: Variants;
  /** Direction-aware slide: +1 forward, -1 back */
  direction?: number;
};

const defaultVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 16 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -16 }),
};

/** Motion-Primitives: Transition Panel — animates between panels (tabs, steps). */
export function TransitionPanel({
  children,
  className,
  panelClassName,
  transition = { duration: 0.2, ease: "easeOut" },
  activeIndex,
  variants = defaultVariants,
  direction = 1,
}: TransitionPanelProps) {
  const panels = Children.toArray(children);
  return (
    <div className={cn("relative", className)}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.div
          key={activeIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          className={panelClassName}
        >
          {panels[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
