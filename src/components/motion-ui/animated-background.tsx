import { AnimatePresence, motion, type Transition } from "motion/react";
import { Children, cloneElement, isValidElement, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

type ChildProps = {
  "data-id": string;
  className?: string;
  children?: React.ReactNode;
};

export type AnimatedBackgroundProps = {
  children: React.ReactElement<ChildProps>[] | React.ReactElement<ChildProps>;
  defaultValue?: string;
  /** Controlled active id (e.g. current route). Overrides internal state when provided. */
  value?: string | null;
  onValueChange?: (newActiveId: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
};

/**
 * Motion-Primitives: Animated Background — a shared highlight that glides
 * between children. Each child needs a `data-id`.
 */
export function AnimatedBackground({
  children,
  defaultValue,
  value,
  onValueChange,
  className,
  transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(defaultValue ?? null);
  const uniqueId = useId();
  const current = value !== undefined ? value : activeId;

  useEffect(() => {
    if (defaultValue !== undefined) setActiveId(defaultValue);
  }, [defaultValue]);

  const set = (id: string | null) => {
    setActiveId(id);
    onValueChange?.(id);
  };

  return (
    <>
      {Children.map(children, (child) => {
        if (!isValidElement<ChildProps>(child)) return child;
        const id = child.props["data-id"];
        // Compose with the child's own handlers rather than replacing them.
        const own = child.props as ChildProps & {
          onClick?: (e: React.MouseEvent) => void;
          onMouseEnter?: (e: React.MouseEvent) => void;
          onMouseLeave?: (e: React.MouseEvent) => void;
        };
        const interaction = enableHover
          ? {
              onMouseEnter: (e: React.MouseEvent) => {
                own.onMouseEnter?.(e);
                set(id);
              },
              onMouseLeave: (e: React.MouseEvent) => {
                own.onMouseLeave?.(e);
                set(defaultValue ?? null);
              },
            }
          : {
              onClick: (e: React.MouseEvent) => {
                own.onClick?.(e);
                set(id);
              },
            };

        const extraProps: Record<string, unknown> = {
          className: cn("relative", child.props.className),
          "data-checked": current === id ? "true" : "false",
          ...interaction,
        };
        return cloneElement(
          child,
          extraProps as Partial<ChildProps>,
          <>
            <AnimatePresence initial={false}>
              {current === id && (
                <motion.div
                  layoutId={`background-${uniqueId}`}
                  className={cn("absolute inset-0", className)}
                  transition={transition}
                  initial={{ opacity: defaultValue || value ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>
            <div className="relative z-10 h-full w-full">{child.props.children}</div>
          </>,
        );
      })}
    </>
  );
}
