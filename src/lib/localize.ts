/**
 * Stored products keep shopper-facing text per language ({ en, tr, tk, ru }).
 * localizeProduct() turns a record into a plain Product in one language,
 * falling back to English for anything not translated yet. Prices, SKU,
 * images, stock and slugs are shared.
 */
import type { Locale } from "@/i18n/config";
import type { L10n, L10nList, NameL10n, Product, ProductRecord, TranslatedLocale } from "@/types";

/** Languages translated from English, in switcher order. */
export const translatedLocales: TranslatedLocale[] = ["tr", "tk", "ru"];

export const pick = (v: L10n | undefined, locale: Locale): string => (v ? (locale !== "en" && v[locale]?.trim() ? v[locale]! : v.en) : "");

export const pickList = (v: L10nList | undefined, locale: Locale): string[] => {
  if (!v) return [];
  const own = locale !== "en" ? v[locale]?.filter((x) => x.trim()) : undefined;
  return own?.length ? own : v.en;
};

const pickName = (name: string, labels: NameL10n | undefined, locale: Locale) =>
  locale !== "en" && labels?.[locale]?.trim() ? labels[locale]! : name;

const cache = new WeakMap<ProductRecord, Partial<Record<Locale, Product>>>();

export function localizeProduct(r: ProductRecord, locale: Locale): Product {
  const hit = cache.get(r)?.[locale];
  if (hit) return hit;

  const p: Product = {
    ...r,
    title: pick(r.title, locale),
    tagline: pick(r.tagline, locale),
    description: pick(r.description, locale),
    features: pickList(r.features, locale),
    featuresEn: r.features.en,
    highlights: pickList(r.highlights, locale),
    material: pick(r.material, locale),
    materialKey: r.material.en,
    weave: r.weave ? pick(r.weave, locale) : undefined,
    origin: r.origin ? pick(r.origin, locale) : undefined,
    careInstructions: r.careInstructions.map((c) => ({ kind: c.kind, text: pick(c.text, locale), textEn: c.text.en })),
    sizes: r.sizes.map(({ labels, note, ...s }) => ({ ...s, label: pickName(s.name, labels, locale), note: note ? pick(note, locale) : undefined })),
    variants: {
      ...r.variants,
      colors: r.variants.colors?.map(({ labels, ...c }) => ({ ...c, label: pickName(c.name, labels, locale) })),
    },
  };
  // Built-in illustrations have no alt text yet: describe them in this language
  const name = p.title;
  const alt = (colour: string | undefined, view: number) => `${name}${colour ? ` – ${colour}` : ""}${view ? ` (${view + 1})` : ""}`;
  p.images = p.images.map((img, i) => (img.alt ? img : { ...img, alt: alt(p.variants.colors?.[0]?.label, i) }));
  if (p.variants.colors)
    p.variants.colors = p.variants.colors.map((c) => (c.images ? { ...c, images: c.images.map((img, i) => (img.alt ? img : { ...img, alt: alt(c.label, i) })) } : c));
  const entry = cache.get(r) ?? {};
  entry[locale] = p;
  cache.set(r, entry);
  return p;
}

/** Display name of a colour / size in the localized product ("Sand" → "Kum"). */
export const colourLabel = (p: Pick<Product, "variants">, name?: string) =>
  (name && p.variants.colors?.find((c) => c.name === name)?.label) || name || "";
export const sizeLabel = (p: Pick<Product, "sizes">, name?: string) => (name && p.sizes?.find((s) => s.name === name)?.label) || name || "";

/* ------------------------------ translation status (admin) ------------------------------ */

export type MissingInfo = Record<TranslatedLocale, string[]>;

/** Which translatable fields are still empty in Turkish / Turkmen / Russian. */
export function missingTranslations(r: ProductRecord): MissingInfo {
  const out: MissingInfo = { tr: [], tk: [], ru: [] };
  for (const l of translatedLocales) {
    const miss = (field: string, empty: boolean) => empty && out[l].push(field);
    miss("name", !r.title[l]?.trim());
    miss("tagline", !!r.tagline.en.trim() && !r.tagline[l]?.trim());
    miss("description", !!r.description.en.trim() && !r.description[l]?.trim());
    miss("features", r.features.en.some((x) => x.trim()) && !r.features[l]?.some((x) => x.trim()));
    miss("material", !!r.material.en.trim() && !r.material[l]?.trim());
    miss("weave", !!r.weave?.en.trim() && !r.weave[l]?.trim());
    miss("origin", !!r.origin?.en.trim() && !r.origin[l]?.trim());
    miss("care", r.careInstructions.some((c) => c.text.en.trim() && !c.text[l]?.trim()));
    miss("colours", !!r.variants.colors?.some((c) => !c.labels?.[l]?.trim()));
    miss("sizes", r.sizes.some((s) => s.name !== "One size" && !/^(XS|S|M|L|XL|XXL)$/.test(s.name) && !s.labels?.[l]?.trim()));
  }
  return out;
}

/** Any (or one given) language still has empty fields — the admin "Missing translations" filter. */
export const hasMissing = (r: ProductRecord, only?: TranslatedLocale) => {
  const m = missingTranslations(r);
  return only ? m[only].length > 0 : translatedLocales.some((l) => m[l].length > 0);
};

/** Text used by search: every language, accent-insensitive (see searchKey in i18n). */
export function searchableText(r: ProductRecord) {
  const all = (v?: L10n) => (v ? [v.en, ...translatedLocales.map((l) => v[l])] : []);
  return [
    ...all(r.title),
    ...all(r.tagline),
    ...all(r.material),
    r.productType,
    r.brand,
    r.sku,
    ...(r.variants.colors ?? []).flatMap((c) => [c.name, ...translatedLocales.map((l) => c.labels?.[l])]),
  ]
    .filter(Boolean)
    .join(" ");
}
