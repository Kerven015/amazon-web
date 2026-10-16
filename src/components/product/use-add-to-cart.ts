import { useRouter } from "@/lib/router";
import { toast } from "sonner";
import { toCartItem, useCart } from "@/lib/store/cart";
import { openPanel } from "@/lib/store/ui";
import { stockFor } from "@/lib/product-utils";
import type { Product, SelectedVariant } from "@/types";
import { translate } from "@/i18n";
import { getProductById } from "@/lib/catalog";
import { colourLabel, sizeLabel } from "@/lib/localize";

export function defaultVariant(product: Product): SelectedVariant {
  return {
    size: product.variants.sizes?.[0],
    color: product.variants.colors?.[0]?.name,
  };
}

/**
 * "Sand / Bath towel" in the current language. Variants are stored by their
 * English names; pass the product (or its id) to translate them.
 */
export function variantLabel(v?: SelectedVariant, product?: Product | string) {
  if (!v) return "";
  const p = typeof product === "string" ? getProductById(product, { includeHidden: true }) : product;
  const colour = p ? colourLabel(p, v.color) : v.color;
  const size = p ? sizeLabel(p, v.size) : v.size;
  return [colour, size === "One size" || (p && v.size === "One size") ? undefined : size].filter(Boolean).join(" / ");
}

/**
 * Adds to the bag, slides the Shopping Bag drawer open and shows a toast
 * with "Continue shopping" / "Go to bag".
 */
export function useAddToCart() {
  const addItem = useCart((s) => s.addItem);
  const router = useRouter();

  return (
    product: Product,
    variant: SelectedVariant = defaultVariant(product),
    quantity = 1,
    { openBag = true }: { openBag?: boolean } = {},
  ) => {
    if (stockFor(product, variant.color, variant.size) <= 0) {
      toast(translate("toasts.optionOutOfStock"), { description: variantLabel(variant, product) || product.title });
      return;
    }
    addItem(toCartItem(product, variant, quantity));
    // One confirmation per action: the bag drawer when it opens, otherwise a toast
    if (openBag) {
      openPanel("cart");
      return;
    }
    const label = variantLabel(variant, product);
    toast(translate("toasts.addedToBag"), {
      description: `${quantity} × ${product.title}${label ? ` — ${label}` : ""}`,
      action: { label: translate("toasts.goToBag"), onClick: () => router.push("/cart") },
      cancel: { label: translate("toasts.continueShopping"), onClick: () => {} },
    });
  };
}
