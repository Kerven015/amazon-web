import { motion, type Variants } from "motion/react";
import { Children } from "react";
import { cn } from "@/lib/utils";

export type PresetType = "fade" | "slide" | "scale" | "blur" | "blur-slide";

export type AnimatedGroupProps = {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
  variants?: { container?: Variants; item?: Variants };
  preset?: PresetType;
  as?: "div" | "ul";
  /**
   * true: the stagger starts once the group scrolls into view (In View behaviour).
   * "item": each child reveals as it enters the viewport, staggered within its row —
   * better for long, growing grids ("Show more").
   */
  inView?: boolean | "item";
  /** Row length used to stagger in "item" mode */
  stagger?: number;
};

const defaultContainer: Variants = {
  visible: { transition: { staggerChildren: 0.05 } },
};

const presets: Record<PresetType, Variants> = {
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.94 }, visible: { opacity: 1, scale: 1 } },
  blur: { hidden: { opacity: 0, filter: "blur(4px)" }, visible: { opacity: 1, filter: "blur(0px)" } },
  "blur-slide": {
    hidden: { opacity: 0, filter: "blur(4px)", y: 16 },
    visible: { opacity: 1, filter: "blur(0px)", y: 0 },
  },
};

const itemTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

/** Motion-Primitives: Animated Group — staggered reveal of children. */
export function AnimatedGroup({
  children,
  className,
  itemClassName,
  variants,
  preset = "slide",
  as = "div",
  inView = false,
  stagger = 4,
}: AnimatedGroupProps) {
  const container = variants?.container ?? defaultContainer;
  const item: Variants = variants?.item ?? {
    hidden: presets[preset].hidden,
    visible: { ...(presets[preset].visible as object), transition: itemTransition },
  };

  const keyOf = (child: unknown, index: number) =>
    (child as { key?: string | null } | null)?.key ?? index;

  if (inView === "item") {
    const els = Children.toArray(children).map((child, index) => {
      const visible = (item.visible ?? {}) as unknown as { transition?: object };
      const delay = (index % stagger) * 0.07;
      const key = keyOf(child, index);
      const props = {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.2 },
        // Variant-level transitions win over the prop, so the delay goes in the variant.
        variants: { ...item, visible: { ...visible, transition: { ...(visible.transition ?? {}), delay } } },
        className: itemClassName,
      };
      return as === "ul" ? (
        <motion.li key={key} {...props}>
          {child}
        </motion.li>
      ) : (
        <motion.div key={key} {...props}>
          {child}
        </motion.div>
      );
    });
    return as === "ul" ? <ul className={cn(className)}>{els}</ul> : <div className={cn(className)}>{els}</div>;
  }

  const trigger = inView
    ? { whileInView: "visible", viewport: { once: true, amount: 0.15 } }
    : { animate: "visible" };

  const items = Children.toArray(children).map((child, index) =>
    as === "ul" ? (
      <motion.li key={keyOf(child, index)} variants={item} className={itemClassName}>
        {child}
      </motion.li>
    ) : (
      <motion.div key={keyOf(child, index)} variants={item} className={itemClassName}>
        {child}
      </motion.div>
    ),
  );

  if (as === "ul") {
    return (
      <motion.ul initial="hidden" {...trigger} variants={container} className={cn(className)}>
        {items}
      </motion.ul>
    );
  }
  return (
    <motion.div initial="hidden" {...trigger} variants={container} className={cn(className)}>
      {items}
    </motion.div>
  );
}
