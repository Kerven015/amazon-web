import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { cn, discountPercent, formatPrice } from "@/lib/utils";
import { useT } from "@/i18n";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { main: string; list: string }> = {
  sm: { main: "text-sm", list: "text-sm" },
  md: { main: "text-lg", list: "text-base" },
  lg: { main: "text-2xl", list: "text-lg" },
};

/**
 * Quiet price line: "From $6.00", with the original struck through and the
 * sale price in the accent colour when discounted.
 */
export function PriceTag({
  price,
  listPrice,
  size = "md",
  animate = false,
  from = false,
  showSavings = false,
  className,
}: {
  price: number;
  listPrice?: number;
  size?: Size;
  animate?: boolean;
  /** Prefix with "From" when the price varies by option */
  from?: boolean;
  /** Show "Save 20%" after the prices */
  showSavings?: boolean;
  className?: string;
}) {
  const t = useT("price");
  const pct = discountPercent(price, listPrice);
  const s = sizes[size];
  const onSale = pct > 0 && !!listPrice;

  return (
    <p className={cn("price flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {from && <span className={cn("text-muted-foreground", size === "sm" ? "text-sm" : "text-sm")}>{t("from")}</span>}
      {onSale && (
        <span className={cn("text-muted-foreground", s.list)}>
          <span className="sr-only">{t("was")} </span>
          <s>{formatPrice(listPrice)}</s>
        </span>
      )}
      <span className={cn("font-medium", s.main, onSale ? "text-accent" : "text-foreground")}>
        {onSale && <span className="sr-only">{t("now")} </span>}
        {animate ? <AnimatedNumber value={price} format={(v) => formatPrice(v)} /> : formatPrice(price)}
      </span>
      {showSavings && onSale && <span className="text-xs font-medium text-accent">{t("save", { pct })}</span>}
    </p>
  );
}
