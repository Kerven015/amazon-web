import type { GridColumns } from "@/components/product/product-grid";
import { colorFamilies } from "@/lib/product-utils";
import type { Product, SortOption } from "@/types";

/* ------------------------------------------------------------------
   Collection state lives in the URL so filters, sort, view and
   "show more" survive refresh and can be shared.
   Multi-select values are comma-separated: ?feel=Soft%20%26%20cosy,Light%20%26%20airy
------------------------------------------------------------------- */

export const PAGE_SIZE = 12;

export const multiKeys = ["type", "feel", "material", "colour", "size", "gsm", "design", "brand"] as const;
export type MultiKey = (typeof multiKeys)[number];

export type CollectionQuery = Record<MultiKey, string[]> & {
  min?: number;
  max?: number;
  fast: boolean;
  stock: boolean;
  sale: boolean;
  sort: SortOption;
  view: GridColumns;
  show: number;
};

/** Sort options (labels: messages → collection.sort.{key}) */
export const sortOptions: SortOption[] = ["recommended", "price-asc", "price-desc", "newest", "bestselling"];

/** Keys owned by the page itself (search term, deals flag) and never touched here. */
const PRESERVE = ["q", "deals"];

const legacySort: Record<string, SortOption> = { featured: "recommended", reviews: "bestselling", rating: "bestselling" };

export function parseQuery(sp: URLSearchParams): CollectionQuery {
  const list = (k: string) =>
    (sp.get(k) ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  const num = (k: string) => {
    const v = sp.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const rawSort = sp.get("sort") ?? "recommended";
  const sort = ((sortOptions as string[]).includes(rawSort) ? rawSort : (legacySort[rawSort] ?? "recommended")) as SortOption;
  const view = Number(sp.get("view"));
  const show = Number(sp.get("show"));

  const q = Object.fromEntries(multiKeys.map((k) => [k, list(k)])) as Record<MultiKey, string[]>;
  return {
    ...q,
    min: num("min"),
    max: num("max"),
    fast: sp.get("fast") === "1",
    stock: sp.get("stock") === "1",
    sale: sp.get("sale") === "1",
    sort,
    view: view === 2 || view === 3 ? view : 4,
    show: Number.isFinite(show) && show >= PAGE_SIZE ? show : PAGE_SIZE,
  };
}

export function serializeQuery(q: CollectionQuery, current: URLSearchParams) {
  const out = new URLSearchParams();
  PRESERVE.forEach((k) => {
    const v = current.get(k);
    if (v !== null) out.set(k, v);
  });
  multiKeys.forEach((k) => q[k].length && out.set(k, q[k].join(",")));
  if (q.min !== undefined) out.set("min", String(q.min));
  if (q.max !== undefined) out.set("max", String(q.max));
  if (q.fast) out.set("fast", "1");
  if (q.stock) out.set("stock", "1");
  if (q.sale) out.set("sale", "1");
  if (q.sort !== "recommended") out.set("sort", q.sort);
  if (q.view !== 4) out.set("view", String(q.view));
  if (q.show !== PAGE_SIZE) out.set("show", String(q.show));
  return out;
}

export function clearFilters(q: CollectionQuery): CollectionQuery {
  return {
    ...q,
    ...(Object.fromEntries(multiKeys.map((k) => [k, [] as string[]])) as Record<MultiKey, string[]>),
    min: undefined,
    max: undefined,
    fast: false,
    stock: false,
    sale: false,
    show: PAGE_SIZE,
  };
}

/* ---------------------------- Matching ---------------------------- */

/** Weight bucket key (labels: messages → filters.gsm.{key}) */
export function gsmBucket(gsm?: number) {
  if (!gsm) return undefined;
  if (gsm < 300) return "light";
  if (gsm < 500) return "mid";
  return "heavy";
}

/** Values a product has for each multi-select group. */
export function valuesFor(p: Product, key: MultiKey): string[] {
  switch (key) {
    case "type":
      return [p.productType];
    case "feel":
      return [p.feel];
    case "material":
      // English name as the stable filter value (the label is translated)
      return [p.materialKey ?? p.material];
    case "colour":
      return colorFamilies(p);
    case "size":
      return p.variants.sizes ?? [];
    case "gsm": {
      const b = gsmBucket(p.weightGsm);
      return b ? [b] : [];
    }
    case "design":
      return [p.design];
    case "brand":
      return [p.brand];
  }
}

export function matches(p: Product, q: CollectionQuery, ignore?: MultiKey | "price") {
  for (const k of multiKeys) {
    if (k === ignore || !q[k].length) continue;
    const vals = valuesFor(p, k);
    if (!q[k].some((v) => vals.includes(v))) return false;
  }
  if (ignore !== "price") {
    if (q.min !== undefined && p.price < q.min) return false;
    if (q.max !== undefined && p.price > q.max) return false;
  }
  if (q.fast && !p.fastDelivery) return false;
  if (q.stock && p.stock <= 0) return false;
  if (q.sale && !(p.listPrice && p.listPrice > p.price)) return false;
  return true;
}

export function applyQuery(products: Product[], q: CollectionQuery) {
  const list = products.filter((p) => matches(p, q));
  switch (q.sort) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "newest":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "bestselling":
      return list.sort((a, b) => b.reviewCount - a.reviewCount);
    default:
      return list;
  }
}

/** Options with counts for a group, counted against every *other* active filter. */
export function facet(products: Product[], q: CollectionQuery, key: MultiKey) {
  const counts = new Map<string, number>();
  products
    .filter((p) => matches(p, q, key))
    .forEach((p) => valuesFor(p, key).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1)));
  // Keep selected options visible even when their count drops to zero.
  q[key].forEach((v) => !counts.has(v) && counts.set(v, 0));
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

export function activeFilterCount(q: CollectionQuery) {
  return (
    multiKeys.reduce((n, k) => n + q[k].length, 0) +
    (q.min !== undefined || q.max !== undefined ? 1 : 0) +
    (q.fast ? 1 : 0) +
    (q.stock ? 1 : 0) +
    (q.sale ? 1 : 0)
  );
}
