import { translate } from "@/i18n";
import { motion, type Transition, useMotionValue } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type CarouselCtx = {
  index: number;
  setIndex: (i: number) => void;
  itemsCount: number;
  setItemsCount: (n: number) => void;
  disableDrag: boolean;
};

const CarouselContext = createContext<CarouselCtx | null>(null);

export function useCarousel() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within <Carousel>");
  return ctx;
}

export type CarouselProps = {
  children: React.ReactNode;
  className?: string;
  initialIndex?: number;
  index?: number;
  onIndexChange?: (i: number) => void;
  disableDrag?: boolean;
  label?: string;
};

/** Motion-Primitives: Carousel — draggable, keyboard-accessible slider. */
export function Carousel({
  children,
  className,
  initialIndex = 0,
  index: externalIndex,
  onIndexChange,
  disableDrag = false,
  label,
}: CarouselProps) {
  const [internalIndex, setInternalIndex] = useState(initialIndex);
  const [itemsCount, setItemsCount] = useState(0);
  const isControlled = externalIndex !== undefined;
  const index = isControlled ? externalIndex : internalIndex;

  const setIndex = (i: number) => {
    if (!isControlled) setInternalIndex(i);
    onIndexChange?.(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && index < itemsCount - 1) setIndex(index + 1);
    if (e.key === "ArrowLeft" && index > 0) setIndex(index - 1);
  };

  return (
    <CarouselContext.Provider value={{ index, setIndex, itemsCount, setItemsCount, disableDrag }}>
      <section
        aria-roledescription={translate("common.carousel")}
        aria-label={label ?? translate("common.carousel")}
        onKeyDown={onKeyDown}
        className={cn("group/carousel relative", className)}
      >
        <div className="overflow-hidden">{children}</div>
      </section>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({
  children,
  className,
  transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
}: {
  children: React.ReactNode;
  className?: string;
  transition?: Transition;
}) {
  const { index, setIndex, setItemsCount, itemsCount, disableDrag } = useCarousel();
  const dragX = useMotionValue(0);
  const count = Children.count(children);

  useEffect(() => setItemsCount(count), [count, setItemsCount]);

  const onDragEnd = () => {
    const x = dragX.get();
    if (x <= -40 && index < itemsCount - 1) setIndex(index + 1);
    else if (x >= 40 && index > 0) setIndex(index - 1);
  };

  return (
    <motion.div
      drag={disableDrag ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      dragMomentum={false}
      style={{ x: dragX }}
      onDragEnd={onDragEnd}
      className={cn("touch-pan-y", !disableDrag && "cursor-grab active:cursor-grabbing")}
    >
      <motion.div
        className={cn("flex", className)}
        animate={{ x: `-${index * 100}%` }}
        transition={transition}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function CarouselItem({
  children,
  className,
  index,
}: {
  children: React.ReactNode;
  className?: string;
  index: number;
}) {
  const { index: active, itemsCount } = useCarousel();
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={translate("common.slideOf", { current: index + 1, total: itemsCount })}
      aria-hidden={index !== active}
      inert={index !== active ? true : undefined}
      className={cn("w-full min-w-0 shrink-0 grow-0 basis-full", className)}
    >
      {children}
    </div>
  );
}

export function CarouselNavigation({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName?: string;
}) {
  const { index, setIndex, itemsCount } = useCarousel();
  const base = cn(
    "pointer-events-auto grid size-10 place-items-center rounded-full bg-card/90 text-foreground shadow-card backdrop-blur transition-opacity hover:bg-card disabled:opacity-0",
    buttonClassName,
  );
  return (
    <div className={cn("pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between", className)}>
      <button type="button" aria-label={translate("common.previousSlide")} className={base} disabled={index === 0} onClick={() => setIndex(index - 1)}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={translate("common.nextSlide")}
        className={base}
        disabled={index >= itemsCount - 1}
        onClick={() => setIndex(index + 1)}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function CarouselIndicator({ className }: { className?: string }) {
  const { index, setIndex, itemsCount } = useCarousel();
  return (
    <div className={cn("absolute inset-x-0 bottom-3 flex justify-center gap-1.5", className)}>
      {Array.from({ length: itemsCount }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={translate("common.goToSlide", { n: i + 1 })}
          aria-current={i === index}
          onClick={() => setIndex(i)}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === index ? "w-6 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80",
          )}
        />
      ))}
    </div>
  );
}
