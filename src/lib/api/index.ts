/**
 * Data access layer.
 *
 * Every function is async and returns plain typed data.
 * Products come from the server (see lib/catalog.ts → GET /api/products, backed by
 * server/lib/db/products.ts). Orders, users and categories are still mock data.
 */
import type {
  Category,
  Order,
  Product,
  Review,
  SearchParams,
  Seller,
  User,
} from "@/types";
import {
  categories,
  currentUser,
  orders,
  sellers,
} from "@/lib/mock-data";
import { collections, getCollectionDef } from "@/lib/collections";
import * as db from "@/lib/catalog";
import { getActiveLocale } from "@/i18n";
import { localizeProduct } from "@/lib/localize";

/** Visible catalogue (hidden products excluded). Products come from the server (/api/products). */
const catalog = () => db.listProducts();

/** Make sure the catalogue has been fetched before reading it. */
const delay = () => db.ensureCatalog();

/* ---------------------------- Categories ---------------------------- */

export async function getCategories(): Promise<Category[]> {
  await delay();
  return categories;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  await delay();
  return categories.find((c) => c.slug === slug) ?? null;
}

/* ----------------------------- Products ----------------------------- */

export async function getProducts(): Promise<Product[]> {
  await delay();
  return catalog();
}

export async function getProductById(id: string, opts: { includeHidden?: boolean } = {}): Promise<Product | null> {
  await delay();
  return db.getProductById(id, opts);
}

/** Product page lookup. Hidden or deleted products return null (→ 404). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  await delay();
  return db.getProductBySlug(slug);
}

/** "Complete the look": items that share a collection with the product but are a different type. */
export async function getMatchingProducts(product: Product, limit = 4): Promise<Product[]> {
  await delay();
  const pool = catalog().filter((p) => p.id !== product.id && p.stock > 0 && p.productType !== product.productType);
  const shared = (p: Product) => (p.collections ?? []).filter((c) => product.collections?.includes(c)).length;
  const sameCollection = pool.filter((p) => shared(p) > 0).sort((a, b) => shared(b) - shared(a) || b.rating - a.rating);
  const sameCategory = pool.filter((p) => p.categorySlug === product.categorySlug && !sameCollection.includes(p));
  return [...sameCollection, ...sameCategory].slice(0, limit);
}

/** "You may also like": same category, closest in type and price first. */
export async function getSameCategory(product: Product, limit = 4): Promise<Product[]> {
  await delay();
  return catalog()
    .filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug)
    .sort((a, b) => Number(b.productType === product.productType) - Number(a.productType === product.productType) || Math.abs(a.price - product.price) - Math.abs(b.price - product.price))
    .slice(0, limit);
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  await delay();
  return ids.map((id) => catalog().find((p) => p.id === id)).filter((p): p is Product => !!p);
}

/** Search in any of the three languages, ignoring accents and case ("havlu", "yumsak", "Bath"). */
export async function searchProducts(params: SearchParams): Promise<Product[]> {
  await delay();
  const locale = getActiveLocale();
  return db
    .searchRecords(params.q ?? "")
    .map((r) => localizeProduct(db.displayRecord(r), locale))
    .filter((p) => (!params.category || p.categorySlug === params.category) && (!params.deals || p.tags.includes("deal")));
}

/** Lightweight suggestions for the header search box. */
export async function getSearchSuggestions(query: string, limit = 6): Promise<Product[]> {
  if (!query.trim()) return [];
  await delay();
  const locale = getActiveLocale();
  return db.searchRecords(query).slice(0, limit).map((r) => localizeProduct(db.displayRecord(r), locale));
}

export async function getDeals(): Promise<Product[]> {
  await delay();
  return catalog()
    .filter((p) => p.tags.includes("deal"))
    .sort((a, b) => (a.dealEndsInHours ?? 99) - (b.dealEndsInHours ?? 99));
}

export async function getBestSellers(limit = 10): Promise<Product[]> {
  await delay();
  return [...catalog()]
    .filter((p) => p.tags.includes("bestseller"))
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, limit);
}

export async function getRecommended(limit = 10): Promise<Product[]> {
  await delay();
  // Mock "recommendation": high-rated items, interleaved across categories.
  return [...catalog()].sort((a, b) => b.rating - a.rating || a.price - b.price).slice(0, limit);
}

export async function getRelatedProducts(product: Product, limit = 8): Promise<Product[]> {
  await delay();
  return catalog()
    .filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug)
    .concat(catalog().filter((p) => p.categorySlug !== product.categorySlug && p.brand === product.brand))
    .slice(0, limit);
}

export async function getFrequentlyBoughtTogether(product: Product): Promise<Product[]> {
  await delay();
  const pool = catalog().filter((p) => p.id !== product.id && p.stock > 0);
  const sameCategory = pool.filter((p) => p.categorySlug === product.categorySlug);
  const other = pool.filter((p) => p.categorySlug !== product.categorySlug && p.price < product.price);
  return [sameCategory[0], other[0] ?? sameCategory[1]].filter((p): p is Product => !!p);
}

/** "Complete the look": complementary items, preferring other categories. */
export async function getCompleteTheLook(exclude: string[] = [], limit = 6): Promise<Product[]> {
  await delay();
  const pool = catalog().filter((p) => !exclude.includes(p.id) && p.stock > 0);
  const anchor = catalog().find((p) => p.id === exclude[0]);
  const same = anchor ? pool.filter((p) => p.categorySlug === anchor.categorySlug) : [];
  const rest = pool.filter((p) => !same.includes(p)).sort((a, b) => b.rating - a.rating);
  return [...same.slice(0, 2), ...rest].slice(0, limit);
}

export async function getNewIn(limit = 8): Promise<Product[]> {
  await delay();
  return [...catalog()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/* ---------------------------- Collections --------------------------- */

export async function getCollection(slug: string) {
  await delay();
  const def = getCollectionDef(slug);
  if (!def) return null;
  return { slug: def.slug, title: def.title, intro: def.intro, products: catalog().filter(def.match) };
}

export async function getCollectionSlugs() {
  return collections.map((c) => c.slug);
}

/* ------------------------------ Reviews ----------------------------- */

export async function getReviewsByProductId(productId: string): Promise<Review[]> {
  await delay();
  return db.getProductById(productId, { includeHidden: true })?.reviews ?? [];
}

/* ------------------------------ Sellers ----------------------------- */

export async function getSellerById(id: string): Promise<Seller | null> {
  await delay();
  return sellers.find((s) => s.id === id) ?? null;
}

/* ------------------------------ Account ----------------------------- */

export async function getCurrentUser(): Promise<User> {
  await delay();
  return currentUser;
}

export async function getOrders(): Promise<Order[]> {
  await delay();
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrderById(id: string): Promise<Order | null> {
  await delay();
  return orders.find((o) => o.id === id) ?? null;
}
