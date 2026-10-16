import { AnimatePresence, motion } from "motion/react";
import { useAdminCard } from "@/components/admin/admin-card-context";
import { AnimatedGroup } from "@/components/motion-ui/animated-group";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { ProductCard } from "./product-card";

export type GridColumns = 2 | 3 | 4;

const columnClasses: Record<GridColumns, string> = {
  2: "grid-cols-2 lg:grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

/**
 * Product grid: 4 columns desktop, 3 tablet, 2 mobile by default.
 * Cards fade up in a stagger as they scroll into view (Animated Group + In View).
 */
export function ProductGrid({
  products,
  columns = 4,
  className,
  priorityCount = 0,
}: {
  products: Product[];
  columns?: GridColumns;
  className?: string;
  priorityCount?: number;
}) {
  const admin = useAdminCard();
  const gridClass = cn("grid gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-y-14", columnClasses[columns], className);
  const sizes = columns === 2 ? "(min-width: 1024px) 45vw, 48vw" : undefined;

  // Admin: deleted cards fade + scale out and the grid closes the gap
  if (admin) {
    return (
      <ul className={gridClass}>
        <AnimatePresence initial={false} mode="popLayout">
          {products.map((p, i) => (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProductCard product={p} priority={i < priorityCount} sizes={sizes} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    );
  }

  return (
    <AnimatedGroup
      as="ul"
      inView="item"
      stagger={columns}
      variants={{
        container: { visible: { transition: { staggerChildren: 0.06 } } },
        item: {
          hidden: { opacity: 0, y: 18 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
        },
      }}
      className={cn("grid gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-y-14", columnClasses[columns], className)}
    >
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          priority={i < priorityCount}
          sizes={columns === 2 ? "(min-width: 1024px) 45vw, 48vw" : undefined}
        />
      ))}
    </AnimatedGroup>
  );
}
