import { motion } from "motion/react";
import { Link } from "@/lib/router";
import { QuantityStepper } from "@/components/product/quantity-stepper";
import { variantLabel } from "@/components/product/use-add-to-cart";
import { cn, formatPrice } from "@/lib/utils";
import type { CartItem as CartItemType } from "@/types";
import { ProductImage } from "@/components/product/product-image";
import { useLocale, useT } from "@/i18n";
import { getProductById } from "@/lib/catalog";
import { LOW_STOCK, productHref } from "@/lib/product-utils";

/** Small text actions with a 40px-tall hit area (the text stays 12px). */
const textBtn = "-my-2 inline-flex min-h-10 items-center px-1 -mx-1 text-xs underline decoration-1 underline-offset-4 transition-colors hover:text-foreground";

/** Bag line item: thumbnail, name, variant, stepper, price, remove. `dense` is for the drawer. */
export function CartItem({
  item,
  mode = "cart",
  dense = false,
  onQuantity,
  onRemove,
  onSaveForLater,
  onMoveToCart,
  onNavigate,
}: {
  item: CartItemType;
  mode?: "cart" | "saved";
  dense?: boolean;
  onQuantity?: (q: number) => void;
  onRemove: () => void;
  onSaveForLater?: () => void;
  onMoveToCart?: () => void;
  onNavigate?: () => void;
}) {
  const t = useT("cart");
  const locale = useLocale();
  // Name and variant in the current language (the bag stores the English names)
  const product = getProductById(item.productId, { includeHidden: true, locale });
  const title = product?.title ?? item.title;
  const label = variantLabel(item.variant, product ?? undefined);
  const onSale = !!item.listPrice && item.listPrice > item.price;
  // The product's own page in the shopper's language (no redirect through /product/:id)
  const href = product ? productHref(product, item.variant.color) : `/product/${item.productId}${item.variant.color ? `?colour=${encodeURIComponent(item.variant.color)}` : ""}`;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex gap-4", dense ? "py-5" : "py-6")}
    >
      <Link
        href={href}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("relative shrink-0 overflow-hidden rounded-xs bg-cream", dense ? "h-[110px] w-[88px]" : "h-40 w-32")}
      >
        <ProductImage src={item.image} alt={title} blurDataURL={item.imageBlur} sizes="128px" iconClassName="size-5" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} onClick={onNavigate} className="line-clamp-2 text-sm leading-snug hover:underline hover:underline-offset-4">
            {title}
          </Link>
          <div className="price shrink-0 text-right text-sm">
            {onSale && <s className="mr-1.5 text-muted-foreground">{formatPrice(item.listPrice! * item.quantity)}</s>}
            <span className={onSale ? "text-accent" : ""}>{formatPrice(item.price * item.quantity)}</span>
            {item.quantity > 1 && <span className="block text-xs text-muted-foreground">{t("each", { price: formatPrice(item.price) })}</span>}
          </div>
        </div>
        {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
        {item.stock > 0 && item.stock <= LOW_STOCK && <p className="mt-1 text-xs text-warning">{t("onlyLeft", { count: item.stock })}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-muted-foreground">
          {mode === "cart" && onQuantity && (
            <QuantityStepper
              size="sm"
              value={item.quantity}
              onChange={onQuantity}
              max={Math.min(10, item.stock)}
              label={t("quantityFor", { title })}
            />
          )}
          {mode === "cart" && onSaveForLater && (
            <button type="button" onClick={onSaveForLater} className={textBtn}>
              {t("saveForLater")}
            </button>
          )}
          {mode === "saved" && (
            <button type="button" onClick={onMoveToCart} className={textBtn}>
              {t("moveToBag")}
            </button>
          )}
          <button type="button" onClick={onRemove} className={textBtn} aria-label={t("removeNamed", { title })}>
            {t("remove")}
          </button>
        </div>
      </div>
    </motion.li>
  );
}
