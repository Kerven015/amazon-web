import { RotateCcw } from "lucide-react";
import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { cn, formatPrice } from "@/lib/utils";
import { FreeShippingProgress } from "./free-shipping-progress";
import { useT } from "@/i18n";

function Money({ value, className }: { value: number; className?: string }) {
  return <AnimatedNumber value={value} format={(v) => formatPrice(v)} className={cn("price", className)} />;
}

/** Totals panel for the bag page and checkout. Prices are tax-inclusive. */
export function OrderSummary({
  subtotal,
  discount = 0,
  shipping,
  tax,
  total,
  savings = 0,
  itemCount,
  showProgress = true,
  shippingLabel,
  children,
  className,
}: {
  subtotal: number;
  discount?: number;
  shipping: number;
  tax: number;
  total: number;
  savings?: number;
  itemCount: number;
  showProgress?: boolean;
  shippingLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useT("cart.summary");
  return (
    <section aria-labelledby="summary-heading" className={cn("rounded-sm bg-muted/60 p-6", className)}>
      <h2 id="summary-heading" className="text-3xl">
        {t("title")}
      </h2>

      {showProgress && subtotal > 0 && <FreeShippingProgress subtotal={subtotal - discount} className="mt-5" />}

      <dl className="mt-5 space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("subtotal", { count: itemCount })}</dt>
          <dd><Money value={subtotal} /></dd>
        </div>
        {savings > 0 && (
          <div className="flex justify-between text-accent">
            <dt>{t("savings")}</dt>
            <dd>−<Money value={savings} /></dd>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-accent">
            <dt>{t("discount")}</dt>
            <dd>−<Money value={discount} /></dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{shippingLabel ?? t("shipping")}</dt>
          <dd>{shipping === 0 ? t("free") : <Money value={shipping} />}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t pt-4">
          <dt className="text-base">{t("total")}</dt>
          <dd className="text-xl font-medium"><Money value={total} /></dd>
        </div>
        <p className="text-xs text-muted-foreground">{t("includesTax", { tax: formatPrice(tax) })}</p>
      </dl>

      {children && <div className="mt-6 space-y-3">{children}</div>}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> {t("reassurance")}
      </p>
    </section>
  );
}
