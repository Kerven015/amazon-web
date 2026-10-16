import { AnimatePresence } from "motion/react";
import { Globe, RotateCcw } from "lucide-react";
import { Link } from "@/lib/router";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { CompleteTheLookMini } from "@/components/product/complete-the-look";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getCompleteTheLook } from "@/lib/api";
import { selectCount, selectDiscount, selectSubtotal, useCart } from "@/lib/store/cart";
import { usePanels } from "@/lib/store/ui";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";
import { CartItem } from "./cart-item";
import { DiscountCode } from "./discount-code";
import { useUsOnlyNotice } from "@/components/layout/announcement-bar";
import { FreeShippingProgress } from "./free-shipping-progress";
import { useT } from "@/i18n";

/** Slide-in "Shopping Bag" opened by add-to-bag and the header bag icon. */
export function CartDrawer() {
  const open = usePanels((s) => s.open === "cart");
  const close = usePanels((s) => s.close);
  const items = useCart((s) => s.items);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const discount = useCart(selectDiscount);
  const { setQuantity, removeItem } = useCart.getState();
  const [look, setLook] = useState<Product[]>([]);
  const [lookLoading, setLookLoading] = useState(false);
  const t = useT("cart");
  const ts = useT("shipping");
  const usOnly = useUsOnlyNotice();

  const ids = items.map((i) => i.productId).join(",");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLookLoading(true);
    getCompleteTheLook(ids ? ids.split(",") : [], 6)
      .then((p) => !cancelled && setLook(p))
      .finally(() => !cancelled && setLookLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, ids]);

  const total = subtotal - discount;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        title={t("title")}
        titleExtra={<span className="text-sm text-muted-foreground">({count})</span>}
        bodyClassName="px-5 sm:px-6"
        footer={
          items.length > 0 ? (
            <div className="space-y-3">
              {/* Subtotal → Discount → Total, so the maths reads top to bottom */}
              <dl className="space-y-1.5">
                {discount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <dt>{t("subtotal")}</dt>
                      <dd className="price">{formatPrice(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-sm text-accent">
                      <dt>{t("discount")}</dt>
                      <dd className="price">−{formatPrice(discount)}</dd>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between">
                  <dt className="text-sm font-semibold">{discount > 0 ? t("total") : t("subtotal")}</dt>
                  <dd>
                    <AnimatedNumber value={total} format={(v) => formatPrice(v)} className="price text-lg font-semibold" />
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">{t("taxNote")}</p>
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout" onClick={close}>
                  {t("checkout")}
                </Link>
              </Button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> {t("freeReturns")}
                </span>
                <Link href="/cart" onClick={close} className="underline underline-offset-4 hover:text-foreground">
                  {t("viewFull")}
                </Link>
              </div>
            </div>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <p className="font-serif text-3xl">{t("emptyTitle")}</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{t("emptyBody")}</p>
            <Button className="mt-6 w-full max-w-xs" size="lg" onClick={close}>
              {t("continueShopping")}
            </Button>
            <p className="mt-6 text-sm text-muted-foreground">
              {t("haveAccount")}{" "}
              <Link href="/login" onClick={close} className="text-foreground underline underline-offset-4">
                {t("logIn")}
              </Link>{" "}
              {t("checkoutFaster")}
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-5">
            {usOnly && (
              <p className="flex items-center gap-2 rounded-sm border border-navy/15 bg-cream px-3 py-2 text-xs text-navy" data-testid="us-only-bag">
                <Globe className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" /> {ts("usOnly")}
              </p>
            )}
            <FreeShippingProgress subtotal={total} />
            <ul className="divide-y border-y">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <CartItem
                    key={item.lineId}
                    item={item}
                    dense
                    onNavigate={close}
                    onQuantity={(q) => setQuantity(item.lineId, q)}
                    onRemove={() => removeItem(item.lineId)}
                  />
                ))}
              </AnimatePresence>
            </ul>
            <DiscountCode />
            <CompleteTheLookMini products={look} onNavigate={close} loading={lookLoading} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
