/**
 * Browser-side product catalogue.
 *
 * Loads product records from the server (GET /api/products, or
 * /api/admin/products in the admin, which includes hidden ones), keeps them in
 * memory and hands out products in the current language (see lib/localize.ts).
 * It refreshes after admin changes and when a shopper comes back to the tab —
 * so edits show up on the store straight away.
 *
 * The server's data layer (server/lib/db/products.ts) is the source of truth.
 */
import { getActiveLocale, type Locale, locales, rawMessage, searchKey } from "@/i18n";
import { productArt } from "@/lib/art";
import { localizeProduct, searchableText } from "@/lib/localize";
import type { ProductImage, ProductRecord } from "@/types";

type Scope = "public" | "admin";

let records: ProductRecord[] = [];
let scope: Scope | null = null;
let loadedAt = 0;
let inflight: Promise<ProductRecord[]> | null = null;
const listeners = new Set<() => void>();
const searchIndex = new WeakMap<ProductRecord, string>();

const TONES = ["#d9cdb8", "#a3b19a", "#b7c6cf", "#e3c1b8", "#c8b18e", "#a9a196", "#b06a4f", "#2b3a55"];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Products without photos get the built-in illustrations (lib/art.ts), drawn in
 * each colour. Stored data stays small; the drawings are generated here.
 * (Alt text is filled in per language by localizeProduct.)
 */
export function withArtwork(p: ProductRecord): ProductRecord {
  const colors = p.variants.colors ?? [];
  const palette = colors.slice(1, 3).map((c) => c.hex);
  const art = (hex: string, view = 0) => productArt({ type: p.productType, design: p.design, color: hex, palette, view, seed: p.id });
  const mainHex = colors[0]?.hex ?? TONES[hash(p.id) % TONES.length];
  const hasPhotos = p.images.some((i) => i.src);

  const images: ProductImage[] = hasPhotos ? p.images : [0, 1, 2].map((v) => ({ src: art(mainHex, v), alt: "" }));
  const nextColors = colors.map((c, i) => {
    if (c.image) return c;
    if (i === 0 && hasPhotos) return { ...c, image: images[0].src, imageBlur: images[0].blurDataURL, images };
    if (hasPhotos) return { ...c, image: images[0].src };
    const views = [0, 1, 2].map((v) => ({ src: art(c.hex, v), alt: "" }));
    return { ...c, image: views[0].src, images: views };
  });

  return { ...p, images, variants: { ...p.variants, colors: colors.length ? nextColors : undefined } };
}

/** Drops generated (data:) images that older admin saves wrote into the data as if they were photos. */
export function stripGenerated(p: ProductRecord): ProductRecord {
  const real = (src?: string) => !!src && !src.startsWith("data:");
  if (p.images.every((i) => real(i.src)) && !(p.variants.colors ?? []).some((c) => (c.image && !real(c.image)) || c.images?.some((i) => !real(i.src)))) return p;
  return {
    ...p,
    images: p.images.filter((i) => real(i.src)),
    variants: {
      ...p.variants,
      colors: p.variants.colors?.map((c) => ({
        ...c,
        image: real(c.image) ? c.image : "",
        imageBlur: real(c.image) ? c.imageBlur : undefined,
        images: c.images?.filter((i) => real(i.src)),
      })),
    },
  };
}

const display = new WeakMap<ProductRecord, ProductRecord>();
/** A record ready to show: photos when it has them, otherwise the illustrations. (Never saved.) */
export function displayRecord(r: ProductRecord): ProductRecord {
  let d = display.get(r);
  if (!d) {
    d = withArtwork(r);
    display.set(r, d);
  }
  return d;
}

let lastRaw = "";

async function fetchRecords(s: Scope): Promise<{ raw: string; list: ProductRecord[] }> {
  const res = await fetch(s === "admin" ? "/api/admin/products" : "/api/products", { credentials: "same-origin", cache: "no-store" });
  if (res.status === 401) throw new Response("Unauthorized", { status: 401 });
  if (!res.ok) throw new Error(`Couldn't load products (${res.status})`);
  const raw = await res.text();
  // Records stay exactly as stored: the admin edits these, so generated
  // illustrations must never reach the form (they would be saved as "photos").
  return { raw, list: (JSON.parse(raw) as ProductRecord[]).map(stripGenerated) };
}

/** Load (once) and return the catalogue for the given scope. */
export function ensureCatalog(s: Scope = scope ?? "public"): Promise<ProductRecord[]> {
  if (scope === s && loadedAt) {
    // Shoppers: serve what we have, and quietly re-check the server if it's older than 30s
    // (an admin may have changed something). The page re-renders if anything changed.
    if (s === "public" && catalogAge() > 30_000 && !inflight) void refreshCatalog("public").catch(() => {});
    return Promise.resolve(records);
  }
  return refreshCatalog(s);
}

/** Force a reload (after admin changes, or when the tab regains focus). */
export function refreshCatalog(s: Scope = scope ?? "public"): Promise<ProductRecord[]> {
  if (inflight && scope === s) return inflight;
  scope = s;
  const wasLoaded = loadedAt > 0;
  inflight = fetchRecords(s)
    .then(({ raw, list }) => {
      const changed = raw !== lastRaw;
      lastRaw = raw;
      if (changed) records = list;
      loadedAt = Date.now();
      // Tell open pages only when data actually changed after the first load
      if (changed && wasLoaded) listeners.forEach((l) => l());
      return records;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function onCatalogChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

type Options = { includeHidden?: boolean; locale?: Locale };

/** Raw records (all languages, no generated artwork) — the admin edits these. */
export function listRecords({ includeHidden = false }: { includeHidden?: boolean } = {}): ProductRecord[] {
  return includeHidden ? records : records.filter((p) => !p.hidden);
}

export function getRecordById(id: string) {
  return records.find((p) => p.id === id) ?? null;
}

/** Products in the current (or given) language; hidden ones only when asked. */
export function listProducts({ includeHidden = false, locale = getActiveLocale() }: Options = {}) {
  return listRecords({ includeHidden }).map((r) => localizeProduct(displayRecord(r), locale));
}

export function getProductBySlug(slug: string, { includeHidden = false, locale = getActiveLocale() }: Options = {}) {
  const r = listRecords({ includeHidden }).find((p) => p.slug === slug);
  return r ? localizeProduct(displayRecord(r), locale) : null;
}

export function getProductById(id: string, { includeHidden = false, locale = getActiveLocale() }: Options = {}) {
  const r = listRecords({ includeHidden }).find((p) => p.id === id);
  return r ? localizeProduct(displayRecord(r), locale) : null;
}

/** Accent-insensitive search across all three languages ("havlu" finds "Havlu", "yumsak" finds "Ýumşak"). */
export function searchRecords(query: string, { includeHidden = false } = {}): ProductRecord[] {
  const terms = searchKey(query).split(" ").filter(Boolean);
  if (!terms.length) return listRecords({ includeHidden });
  return listRecords({ includeHidden }).filter((r) => {
    let key = searchIndex.get(r);
    if (key === undefined) {
      // + the product type in every language ("Bath Towels" / "Banyo Havluları" / "Hammam elsüpürgiçleri")
      const types = locales.map((l) => rawMessage(`productTypes.${r.productType}`, l) ?? "").join(" ");
      key = searchKey(`${searchableText(r)} ${types}`);
      searchIndex.set(r, key);
    }
    return terms.every((t) => key!.includes(t));
  });
}

export function catalogScope() {
  return scope;
}

export function catalogAge() {
  return loadedAt ? Date.now() - loadedAt : Infinity;
}

/* Shoppers: pick up admin changes when they return to the tab. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && scope === "public" && catalogAge() > 30_000) void refreshCatalog("public").catch(() => {});
  });
}
