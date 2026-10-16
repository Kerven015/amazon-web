import { Link } from "@/lib/router";
import { variantLabel } from "@/components/product/use-add-to-cart";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/types";
import { ProductImage } from "@/components/product/product-image";
import { useLocale, useT } from "@/i18n";
import { getProductById } from "@/lib/catalog";
import { productHref } from "@/lib/product-utils";

/** Items + totals block shared by confirmation and order detail pages. */
export function OrderItemsList({ order }: { order: Order }) {
  const t = useT("orders");
  const locale = useLocale();
  return (
    <ul className="divide-y">
      {order.items.map((i) => {
        // Current name, photo and variant names from the live catalogue (fallback: what was ordered)
        const product = getProductById(i.productId, { includeHidden: true, locale });
        const title = product?.title ?? i.title;
        const label = variantLabel(i.variant, product ?? undefined);
        const href = product ? productHref(product, i.variant?.color) : null;
        const unit = i.quantity > 1 ? t("each", { price: formatPrice(i.price) }) : null;
        return (
          <li key={`${i.productId}-${i.variant?.color ?? ""}-${i.variant?.size ?? ""}`} className="flex items-center gap-3 py-3">
            {href ? (
              <Link href={href} className="relative size-16 shrink-0 overflow-hidden rounded-sm border bg-cream" tabIndex={-1} aria-hidden="true">
                <ProductImage src={i.image || product?.images[0]?.src || ""} alt="" sizes="64px" iconClassName="size-4" />
              </Link>
            ) : (
              <span className="relative size-16 shrink-0 overflow-hidden rounded-sm border bg-cream">
                <ProductImage src={i.image} alt="" sizes="64px" iconClassName="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1 text-sm">
              {href ? (
                <Link href={href} className="line-clamp-1 font-medium hover:underline">
                  {title}
                </Link>
              ) : (
                <span className="line-clamp-1 font-medium">{title}</span>
              )}
              <p className="text-xs text-muted-foreground">
                {label && `${label} · `}
                {t("qty", { count: i.quantity })}
              </p>
            </div>
            <span className="text-right text-sm">
              <span className="price block font-semibold">{formatPrice(i.price * i.quantity)}</span>
              {unit && <span className="price block text-xs text-muted-foreground">{unit}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Items → Discount → Shipping → Total. Prices include tax, so tax is a note, not a line that adds up. */
export function OrderTotals({ order }: { order: Order }) {
  const t = useT("orders.totals");
  // Orders don't store the discount separately; it's whatever makes the lines add up.
  const discount = Math.round((order.subtotal + order.shipping - order.total) * 100) / 100;
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{t("items")}</dt>
        <dd className="price">{formatPrice(order.subtotal)}</dd>
      </div>
      {discount > 0.004 && (
        <div className="flex justify-between text-accent">
          <dt>{t("discount")}</dt>
          <dd className="price">−{formatPrice(discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{t("shipping")}</dt>
        <dd className="price">{order.shipping === 0 ? t("free") : formatPrice(order.shipping)}</dd>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-bold">
        <dt>{t("total")}</dt>
        <dd className="price">{formatPrice(order.total)}</dd>
      </div>
      {order.tax > 0 && <p className="text-xs text-muted-foreground">{t("includesTax", { tax: formatPrice(order.tax) })}</p>}
    </dl>
  );
}
