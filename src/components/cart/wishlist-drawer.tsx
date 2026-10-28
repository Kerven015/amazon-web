import { productHref } from "@/lib/product-utils";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/lib/router";
import { useEffect, useState } from "react";
import { PriceTag } from "@/components/product/price-tag";
import { defaultVariant, useAddToCart } from "@/components/product/use-add-to-cart";
import { needsOptions, QuickAddSheet } from "@/components/product/quick-add";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getProductsByIds } from "@/lib/api";
import { hasPriceRange } from "@/lib/product-utils";
import { usePanels } from "@/lib/store/ui";
import { useWishlist } from "@/lib/store/wishlist";
import { loginHref, useSession } from "@/lib/session";
import type { Product } from "@/types";
import { ProductImage } from "@/components/product/product-image";
import { useLocale, useT } from "@/i18n";

const NONE: string[] = [];

/** Same drawer pattern as the bag, listing saved items (signed-in customers only). */
export function WishlistDrawer() {
  const open = usePanels((s) => s.open === "wishlist");
  const close = usePanels((s) => s.close);
  const signedIn = useSession((s) => s.status === "signedIn");
  const allIds = useWishlist((s) => s.ids);
  // The wishlist belongs to an account; signed out, the drawer asks them to sign in
  const ids = signedIn ? allIds : NONE;
  const remove = useWishlist((s) => s.remove);
  const addToCart = useAddToCart();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  // Products with sizes/colours open the picker instead of adding a default option
  const [picking, setPicking] = useState<Product | null>(null);
  const t = useT("wishlist");
  const locale = useLocale();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getProductsByIds(ids)
      .then((p) => !cancelled && setItems(p))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, ids, locale]);

  const list = items.filter((p) => ids.includes(p.id));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        title={t("title")}
        titleExtra={<span className="text-sm text-muted-foreground">({ids.length})</span>}
        bodyClassName="px-5 sm:px-6"
        footer={
          list.length > 0 ? (
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/account?tab=wishlist" onClick={close}>
                {t("viewAllAccount")}
              </Link>
            </Button>
          ) : undefined
        }
      >
        {!signedIn ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <p className="font-serif text-3xl">{t("signedOutTitle")}</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{t("signedOutBody")}</p>
            <Button asChild className="mt-6 w-full max-w-xs" size="lg">
              <Link href={loginHref(typeof window === "undefined" ? "/" : window.location.pathname + window.location.search)} onClick={close}>
                {t("signIn")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="mt-3 w-full max-w-xs" size="lg">
              <Link href="/register" onClick={close}>{t("createAccount")}</Link>
            </Button>
          </div>
        ) : ids.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <p className="font-serif text-3xl">{t("emptyTitle")}</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{t("emptyBody")}</p>
            <Button className="mt-6 w-full max-w-xs" size="lg" onClick={close}>
              {t("continueShopping")}
            </Button>
          </div>
        ) : loading && list.length === 0 ? (
          <ul className="divide-y" aria-busy="true" data-testid="wishlist-skeleton">
            {ids.slice(0, 4).map((id) => (
              <li key={id} className="flex gap-4 py-5">
                <Skeleton className="h-[110px] w-[88px] shrink-0 rounded-xs" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-24 rounded-xs" />
                  <Skeleton className="h-4 w-40 rounded-xs" />
                  <Skeleton className="h-4 w-16 rounded-xs" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y">
            <AnimatePresence initial={false}>
              {list.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
                  className="flex gap-4 py-5"
                >
                  <Link href={productHref(p)} onClick={close} className="relative h-[110px] w-[88px] shrink-0 overflow-hidden rounded-xs bg-cream">
                    <ProductImage src={p.images[0]?.src ?? ""} alt={p.images[0]?.alt ?? p.title} blurDataURL={p.images[0]?.blurDataURL} sizes="88px" iconClassName="size-5" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-xs text-muted-foreground">{p.tagline}</p>
                    <Link href={productHref(p)} onClick={close} className="line-clamp-2 text-sm hover:underline">
                      {p.title}
                    </Link>
                    <PriceTag price={p.price} listPrice={p.listPrice} size="sm" from={hasPriceRange(p)} className="mt-1" />
                    <div className="mt-auto flex items-center gap-4 pt-2 text-xs">
                      <button
                        type="button"
                        disabled={p.stock <= 0}
                        aria-haspopup={needsOptions(p) ? "dialog" : undefined}
                        onClick={() => (needsOptions(p) ? setPicking(p) : addToCart(p, defaultVariant(p)))}
                        className="-my-2 inline-flex min-h-10 items-center font-medium underline underline-offset-4 disabled:no-underline disabled:opacity-50"
                      >
                        {p.stock <= 0 ? t("soldOut") : t("addToBag")}
                      </button>
                      <button type="button" onClick={() => remove(p.id)} aria-label={t("removeNamed", { title: p.title })} className="-my-2 inline-flex min-h-10 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground">
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {picking && <QuickAddSheet product={picking} open={!!picking} onOpenChange={(o) => !o && setPicking(null)} />}
      </SheetContent>
    </Sheet>
  );
}
