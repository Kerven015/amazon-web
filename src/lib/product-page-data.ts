import {
  getCategoryBySlug,
  getMatchingProducts,
  getProductBySlug,
  getSameCategory,
  getSellerById,
} from "@/lib/api";
import { onCatalogChange } from "@/lib/catalog";
import { getActiveLocale, translate } from "@/i18n";
import { typeCollection } from "@/lib/navigation";
import { getCollectionDef } from "@/lib/collections";
import type { Product } from "@/types";


async function load(slug: string) {
  const product = await getProductBySlug(slug);
  if (!product) return null;
  const [seller, look, related, category] = await Promise.all([
    getSellerById(product.sellerId),
    getMatchingProducts(product, 4),
    getSameCategory(product, 4),
    getCategoryBySlug(product.categorySlug),
  ]);
  const def = getCollectionDef(typeCollection[product.productType] ?? "");
  const crumb = def
    ? { label: translate(`collections.${def.slug}.title`), href: `/collections/${def.slug}` }
    : category
      ? { label: translate("collections.all-towels.title"), href: "/collections/all-towels" }
      : null;
  return { product, seller, look, related, crumb };
}

export type ProductPageData = NonNullable<Awaited<ReturnType<typeof load>>>;

/**
 * Short-lived cache so hovering a card can start loading the page
 * (the React Router stand-in for Next.js <Link prefetch>).
 */
const cache = new Map<string, { at: number; promise: Promise<ProductPageData | null> }>();
const TTL = 15_000;

export function loadProductPage(slug: string) {
  // Cached per language: the same product page in TR and TK has different text
  const key = `${getActiveLocale()}:${slug}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = load(slug);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

const warmed = new Set<string>();

/** Warm data + main image for a product page. Safe to call often. */
export function prefetchProduct(product: Pick<Product, "slug" | "images">) {
  void loadProductPage(product.slug);
  const src = product.images[0]?.src;
  if (src && !src.startsWith("data:") && !warmed.has(src)) {
    warmed.add(src);
    const img = new Image();
    img.src = src;
  }
}

/** Call after an admin edit so the next visit reads fresh data. */
export function clearProductPageCache() {
  cache.clear();
}

// Fresh catalogue → forget cached product pages
onCatalogChange(clearProductPageCache);
