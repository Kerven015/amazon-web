import { Pencil, Trash2 } from "lucide-react";
import { Link } from "@/lib/router";
import { useState } from "react";
import { useAdminCard } from "@/components/admin/admin-card-context";
import { upper, useLocale, useT } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { prefetchProduct } from "@/lib/product-page-data";
import { colorImage, hasPriceRange, productHref, stockFor } from "@/lib/product-utils";
import { cn, discountPercent } from "@/lib/utils";
import type { Product } from "@/types";
import { PriceTag } from "./price-tag";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";
import { SwatchRow } from "./swatch-row";
import { WishlistButton } from "./wishlist-button";

export type ProductCardProps = {
  product: Product;
  /** `compact` is for drawers / search: no quick add or swatches */
  size?: "default" | "compact";
  className?: string;
  priority?: boolean;
  sizes?: string;
};

/** Badge text is uppercased in code with the page language, so Turkish "i" becomes "İ". */
export function CardBadge({ product }: { product: Product }) {
  const t = useT("badges");
  const locale = useLocale();
  const pct = discountPercent(product.price, product.listPrice);
  if (product.stock <= 0 || product.stockStatus === "out") return <Badge variant="neutral">{upper(t("soldOut"), locale)}</Badge>;
  if (pct > 0) return <Badge variant="deal">−{pct}%</Badge>;
  if (product.badge) return <Badge variant="surface">{upper(t(product.badge), locale)}</Badge>;
  return null;
}

/**
 * The one product card used across the site.
 * Desktop: hover crossfades to the second image and reveals Quick add.
 * Touch: swipeable image strip with dots and a visible Quick add button.
 * Swatches preview (hover) and select (click) per-colour images.
 */
export function ProductCard({
  product,
  size = "default",
  className,
  priority,
  sizes = "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw",
}: ProductCardProps) {
  const colors = product.variants.colors ?? [];
  const [selected, setSelected] = useState<string | undefined>(colors[0]?.name);
  const [preview, setPreview] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const compact = size === "compact";
  // Admin catalog: same card, but it opens the edit page and shows admin controls
  const admin = useAdminCard();
  // A swatch picked on the card carries over to the product page (?colour=sand)
  const href = admin ? admin.editHref(product) : productHref(product, selected && selected !== colors[0]?.name ? selected : undefined);
  // Start loading the product page when the card is hovered/focused/touched (≈ Next.js prefetch)
  const prefetch = () => {
    if (!admin) prefetchProduct(product);
  };
  const checked = !!admin?.selected.has(product.id);
  const t = useT("productCard");

  const shownColor = preview ?? selected;
  const primary = colorImage(product, shownColor);
  const swapped = shownColor && shownColor !== colors[0]?.name;
  // Hover crossfades to gallery-1 (images[1]) unless a different colour is showing
  const secondary = product.images[1]?.src ? product.images[1] : undefined;
  const mobileImages = [primary, ...product.images.slice(1, 3).filter((img) => img.src)];

  return (
    <article
      className={cn("group relative flex flex-col", checked && "[&>div:first-child]:ring-2 [&>div:first-child]:ring-navy [&>div:first-child]:ring-offset-2", className)}
      onPointerEnter={prefetch}
      onFocusCapture={prefetch}
      onTouchStart={prefetch}
    >
      <div className="relative z-[2] overflow-hidden rounded-xs bg-cream">
        {/* Desktop / hover devices: crossfade */}
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className={cn("relative block aspect-[4/5]", !compact && "hidden [@media(hover:hover)]:block")}
        >
          <ProductImage
            src={primary.src}
            alt={primary.alt}
            blurDataURL={primary.blurDataURL}
            priority={priority}
            sizes={sizes}
            className={cn(
              "transition-opacity duration-500 ease-calm",
              !swapped && secondary && !compact && "group-hover:opacity-0",
              product.stock <= 0 && "opacity-70",
            )}
          />
          {secondary && !swapped && !compact && (
            <ProductImage
              src={secondary.src}
              alt={secondary.alt}
              blurDataURL={secondary.blurDataURL}
              sizes={sizes}
              decorative
              className="opacity-0 transition-opacity duration-500 ease-calm group-hover:opacity-100"
            />
          )}
        </Link>

        {/* Touch devices: swipeable strip */}
        {!compact && (
          <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block [@media(hover:hover)]:hidden">
            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                setSlide(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="scrollbar-none flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto"
            >
              {mobileImages.map((img, i) => (
                <div key={`${img.src}-${i}`} className="relative h-full w-full shrink-0 snap-center bg-cream">
                  <ProductImage
                    src={img.src}
                    alt={img.alt}
                    blurDataURL={img.blurDataURL}
                    sizes={sizes}
                    priority={priority && i === 0}
                    decorative={i > 0}
                  />
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5" aria-hidden="true">
              {mobileImages.length > 1 && mobileImages.map((_, i) => (
                <span key={i} className={cn("size-1.5 rounded-full transition-colors duration-300", i === slide ? "bg-foreground" : "bg-foreground/25")} />
              ))}
            </div>
          </Link>
        )}

        <div className={cn("absolute top-2.5 z-10 flex flex-wrap gap-1", admin ? "left-11" : "left-2.5")}>
          <CardBadge product={product} />
          {admin && product.hidden && <Badge variant="neutral">{t("hidden")}</Badge>}
        </div>
        {admin ? (
          <>
            <label className="absolute left-2 top-2 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-surface/90 backdrop-blur-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => admin.toggle(product.id)}
                aria-label={t("select", { title: product.title })}
                className="size-4 cursor-pointer accent-[var(--navy)]"
              />
            </label>
            <div className="absolute right-2 top-2 z-10 flex gap-1.5">
              <Link
                href={admin.editHref(product)}
                aria-label={t("edit", { title: product.title })}
                title={t("editShort")}
                className="grid size-9 place-items-center rounded-full bg-surface/90 text-navy shadow-card backdrop-blur-sm transition-colors hover:bg-navy hover:text-cream"
              >
                <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  admin.remove(product);
                }}
                aria-label={t("delete", { title: product.title })}
                title={t("deleteShort")}
                className="grid size-9 place-items-center rounded-full bg-surface/90 text-danger shadow-card backdrop-blur-sm transition-colors hover:bg-danger hover:text-white"
              >
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <WishlistButton productId={product.id} title={product.title} className="absolute right-2 top-2 z-10" />
        )}

        {!compact && !admin && (
          <div className="hidden [@media(hover:hover)]:block">
            <QuickAdd product={product} color={selected} onColorChange={setSelected} mode="hover" />
          </div>
        )}
      </div>

      {!compact && !admin && (
        <div className="[@media(hover:hover)]:hidden">
          <QuickAdd product={product} color={selected} onColorChange={setSelected} mode="inline" />
        </div>
      )}

      <div className={cn("flex flex-1 flex-col pt-3", compact ? "gap-0.5" : "gap-1")}>
        <p className="text-xs text-muted-foreground">{product.tagline}</p>
        <h3 className={cn("leading-snug", compact ? "line-clamp-1 text-sm" : "line-clamp-2 text-[15px]")}>
          <Link href={href} className="after:absolute after:inset-0 after:z-[1] after:content-[''] hover:underline hover:decoration-1 hover:underline-offset-4">
            {product.title}
          </Link>
        </h3>
        <PriceTag price={product.price} listPrice={product.listPrice} size="sm" from={hasPriceRange(product)} />
        {!compact && colors.length > 1 && (
          <SwatchRow
            colors={colors}
            value={selected}
            onPreview={setPreview}
            onSelect={setSelected}
            moreHref={admin ? undefined : productHref(product)}
            label={t("coloursFor", { title: product.title })}
            isOut={(c) => stockFor(product, c) <= 0}
            className="relative z-[2] mt-1.5"
          />
        )}
      </div>
    </article>
  );
}
