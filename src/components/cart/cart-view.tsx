import { AnimatePresence } from "motion/react";
import { Link } from "@/lib/router";
import { TextShimmer } from "@/components/motion-ui/text-shimmer";
import { ProductRow } from "@/components/product/product-row";
import { Button } from "@/components/ui/button";
import { useStoreHydrated } from "@/lib/hooks/use-store-hydrated";
import { computeTotals, selectCount, selectDiscount, selectSubtotal, useCart } from "@/lib/store/cart";
import type { Product } from "@/types";
import { CartItem } from "./cart-item";
import { CheckoutButton } from "./checkout-button";
import { DiscountCode } from "./discount-code";
import { OrderSummary } from "./order-summary";
import { useT } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { cn, formatPrice } from "@/lib/utils";

/** Full-page bag (/cart): line items, saved for later, summary with progress. */
export function CartView({ suggestions }: { suggestions: Product[] }) {
  const hydrated = useStoreHydrated(useCart);
  const items = useCart((s) => s.items);
  const saved = useCart((s) => s.saved);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const discount = useCart(selectDiscount);
  const { setQuantity, removeItem, saveForLater, moveToCart, removeSaved } = useCart.getState();
  const totals = computeTotals(subtotal, undefined, discount);
  const t = useT("cart");
  // Phones/tablets: a sticky total + checkout bar while the summary is off screen
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(true);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSummaryVisible(e.isIntersecting), { rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hydrated, items.length > 0]);

  if (!hydrated) {
    return (
      <p role="status" className="py-24 text-center text-lg">
        <TextShimmer>{t("loading")}</TextShimmer>
      </p>
    );
  }

  return (
    <div className="space-y-20">
      {items.length === 0 ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto sm:text-6xl">{t("emptyTitle")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Button asChild size="lg" className="mt-7 w-full">
            <Link href="/search">{t("continueShopping")}</Link>
          </Button>
          <p className="mt-6 text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4">
              {t("logIn")}
            </Link>{" "}
            {t("checkoutFaster")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
          <section aria-labelledby="cart-heading" className="min-w-0">
            <h1 id="cart-heading" className="text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto sm:text-6xl">
              {t("title")} <span className="font-sans text-base text-muted-foreground">({count})</span>
            </h1>
            <ul className="mt-8 divide-y border-y">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <CartItem
                    key={item.lineId}
                    item={item}
                    onQuantity={(q) => setQuantity(item.lineId, q)}
                    onRemove={() => removeItem(item.lineId)}
                    onSaveForLater={() => saveForLater(item.lineId)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>

          <div ref={summaryRef} className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <OrderSummary {...totals} itemCount={count} shippingLabel={t("standardDelivery")}>
              <CheckoutButton className="w-full" />
            </OrderSummary>
            <DiscountCode />
          </div>

          <div
            data-testid="cart-sticky-bar"
            aria-hidden={summaryVisible}
            inert={summaryVisible ? true : undefined}
            className={cn(
              "fixed inset-x-0 bottom-0 z-30 border-t bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[transform,opacity] duration-300 ease-calm lg:hidden",
              summaryVisible ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100",
            )}
          >
            <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
              <p className="min-w-0 text-sm">
                <span className="block text-xs text-muted-foreground">{t("summary.total")}</span>
                <span className="price text-lg font-semibold">{formatPrice(totals.total)}</span>
              </p>
              <CheckoutButton className="shrink-0" note={false} />
            </div>
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <section aria-labelledby="saved-heading">
          <h2 id="saved-heading" className="text-3xl">
            {t("savedForLater")} <span className="font-sans text-base text-muted-foreground">({saved.length})</span>
          </h2>
          <ul className="mt-6 divide-y border-y">
            <AnimatePresence initial={false}>
              {saved.map((item) => (
                <CartItem
                  key={item.lineId}
                  item={item}
                  mode="saved"
                  onRemove={() => removeSaved(item.lineId)}
                  onMoveToCart={() => moveToCart(item.lineId)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <ProductRow eyebrow={t("pairsWell")} title={t("completeTheLook")} products={suggestions} />
    </div>
  );
}
