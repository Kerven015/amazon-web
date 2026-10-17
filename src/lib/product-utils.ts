import { formatNumber, translate } from "@/i18n";
import * as pricing from "@/lib/pricing";
import type { ColorFamily, Product, ProductImage, ProductSize, SelectedVariant } from "@/types";

export function findSize(product: Product, name?: string): ProductSize | undefined {
  return product.sizes?.find((s) => s.name === name);
}

/** Price for a specific size: { price (what you pay), listPrice (struck through when on sale) }. */
export function sizePrice(size: Pick<ProductSize, "price" | "salePrice">) {
  return pricing.sizePrice(size);
}

/** Price for a variant; without a size it's the product's "from" price. */
export function priceFor(product: Product, variant?: SelectedVariant) {
  const size = findSize(product, variant?.size) ?? (product.sizes?.length === 1 ? product.sizes[0] : undefined);
  if (size) return sizePrice(size);
  return { price: product.price, listPrice: product.listPrice };
}

/** True when the card should say "From $X" (price varies by size). */
export function hasPriceRange(product: Product) {
  return new Set((product.sizes ?? []).map((s) => sizePrice(s).price)).size > 1;
}

const colourKey = (product: Product, colour?: string) =>
  product.variants.colors?.length ? colour : "default";

/**
 * Units in stock for a colour/size combination. Leave either out to sum over it.
 * Falls back to product.stock for products without size data.
 */
export function stockFor(product: Product, colour?: string, size?: string): number {
  // Manual "Out of stock" in the admin wins over quantities
  if (product.stockStatus === "out") return 0;
  if (!product.sizes?.length) return product.stock;
  const key = colourKey(product, colour);
  const sizes = size ? product.sizes.filter((s) => s.name === size) : product.sizes;
  return sizes.reduce(
    (n, s) => n + (key ? (s.stock[key] ?? 0) : Object.values(s.stock).reduce((a, b) => a + b, 0)),
    0,
  );
}

/** Sum of all stock cells (keeps product.stock in sync after admin edits). */
export function totalStock(sizes: ProductSize[]) {
  return sizes.reduce((n, s) => n + Object.values(s.stock).reduce((a, b) => a + (Number(b) || 0), 0), 0);
}

export const cmToIn = (cm: number) => Math.round((cm / 2.54) * 10) / 10;

/** "70 × 130 cm" / "28 × 51 in" — unit names and numbers in the current language. */
export function dimensionLabel(size: ProductSize, unit: "cm" | "in" = "cm") {
  const f = (v: number) => formatNumber(unit === "cm" ? v : cmToIn(v));
  const u = translate(`sizeGuide.units.${unit}`);
  if (size.widthCm && size.lengthCm) return `${f(size.widthCm)} × ${f(size.lengthCm)} ${u}`;
  if (size.lengthCm) return translate("sizeGuide.length", { value: `${f(size.lengthCm)} ${u}` });
  return size.note ?? "—";
}

/** Product page URL; pass a colour to preselect it (?colour=sand). */
/** "Only X left" shows at this stock level or below. */
export const LOW_STOCK = 3;

export function productHref(product: Pick<Product, "slug">, colour?: string) {
  return `/products/${product.slug}${colour ? `?colour=${encodeURIComponent(colour.toLowerCase())}` : ""}`;
}

/** The image for a colour variant (or the main image), with alt text for that colour. */
export function colorImage(product: Product, colorName?: string): ProductImage {
  const main = product.images[0];
  const colour = product.variants.colors?.find((c) => c.name === colorName);
  if (!colour || colour === product.variants.colors?.[0]) return main;
  return {
    src: colour.image,
    alt: `${product.title} in ${colour.name} – ${product.productType}`,
    blurDataURL: colour.imageBlur,
  };
}

/** Gallery for the selected colour: its own images, or its photo + the product gallery. */
export function colorGallery(product: Product, colorName?: string): ProductImage[] {
  const colour = product.variants.colors?.find((c) => c.name === colorName);
  if (colour?.images?.length) return colour.images;
  return [colorImage(product, colorName), ...product.images.slice(1)].filter((i, n) => n === 0 || !!i.src);
}

/** Representative swatch per colour family for the colour filter. */
export const familySwatches: Record<ColorFamily, string> = {
  White: "#f1ede4",
  Neutral: "#cdbb9c",
  Grey: "#8d8a85",
  Black: "#26231f",
  Green: "#6f8a6a",
  Blue: "#4c6688",
  Pink: "#d8a9a2",
  Red: "#a5503a",
};

export function colorFamilies(product: Product): ColorFamily[] {
  return [...new Set(product.variants.colors?.map((c) => c.family) ?? [])];
}
