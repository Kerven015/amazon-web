import { productHref } from "@/lib/product-utils";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import { Link } from "@/lib/router";
import { hasPriceRange } from "@/lib/product-utils";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";
import { defaultVariant, useAddToCart } from "./use-add-to-cart";
import { ProductImage } from "./product-image";
import { useT } from "@/i18n";

/** Compact horizontal row of complementary items with one-tap add (used in the bag drawer). */
export function CompleteTheLookMini({ products, onNavigate, loading = false }: { products: Product[]; onNavigate?: () => void; loading?: boolean }) {
  const addToCart = useAddToCart();
  const t = useT("productPage");
  const tp = useT("price");
  if (loading && !products.length) {
    return (
      <section aria-busy="true" aria-labelledby="ctl-mini" data-testid="ctl-skeleton">
        <h3 id="ctl-mini" className="mb-3 font-serif text-xl">
          {t("completeTheLook")}
        </h3>
        <ul className="-mx-5 flex gap-3 overflow-hidden px-5 sm:-mx-6 sm:px-6">
          {[0, 1, 2].map((i) => (
            <li key={i} className="w-[132px] shrink-0">
              <Skeleton className="aspect-[4/5] w-full rounded-xs" />
              <Skeleton className="mt-2 h-3 w-24 rounded-xs" />
              <Skeleton className="mt-1.5 h-3 w-12 rounded-xs" />
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (!products.length) return null;
  return (
    <section aria-labelledby="ctl-mini">
      <h3 id="ctl-mini" className="mb-3 font-serif text-xl">
        {t("completeTheLook")}
      </h3>
      <ul className="scrollbar-none -mx-5 flex snap-x gap-3 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        {products.map((p) => (
          <li key={p.id} className="w-[132px] shrink-0 snap-start">
            <div className="relative">
              <Link href={productHref(p)} onClick={onNavigate} className="relative block aspect-[4/5] overflow-hidden rounded-xs bg-cream">
                <ProductImage src={p.images[0]?.src ?? ""} alt={p.images[0]?.alt ?? p.title} blurDataURL={p.images[0]?.blurDataURL} sizes="132px" iconClassName="size-5" />
              </Link>
              <button
                type="button"
                aria-label={t("addNamedToBag", { title: p.title })}
                onClick={() => addToCart(p, defaultVariant(p), 1, { openBag: false })}
                className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-surface/95 transition-colors hover:bg-foreground hover:text-background"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <Link href={productHref(p)} onClick={onNavigate} className="mt-2 line-clamp-2 block text-xs leading-snug hover:underline">
              {p.title}
            </Link>
            <p className="price mt-0.5 text-xs text-muted-foreground">
              {hasPriceRange(p) && `${tp("from")} `}
              {formatPrice(p.price)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
