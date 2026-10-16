/**
 * Product data layer — the ONLY place that knows where products are stored.
 *
 * Today: a JSON file at data/products.json (writes are atomic and queued).
 * To move to Supabase/Postgres later, re-implement these functions with the
 * same signatures; nothing else on the server or in the browser changes.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ProductRecord as Product } from "../../../src/types";
import { env } from "../../env";

function file() {
  return path.resolve(process.cwd(), env("DATA_DIR") ?? "data", "products.json");
}

let cache: { mtime: number; products: Product[] } | null = null;

function readAll(): Product[] {
  const f = file();
  if (!existsSync(f)) return [];
  const { mtimeMs } = statSync(f);
  if (cache && cache.mtime === mtimeMs) return cache.products;
  const products = JSON.parse(readFileSync(f, "utf8")) as Product[];
  cache = { mtime: mtimeMs, products };
  return products;
}

/** Writes go through one queue so two quick saves can't interleave. */
let queue: Promise<unknown> = Promise.resolve();
function writeAll(products: Product[]) {
  const run = queue.then(() => {
    const f = file();
    mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(products, null, 2));
    renameSync(tmp, f); // atomic replace
    cache = null;
  });
  queue = run.catch(() => {});
  return run;
}

type Options = { includeHidden?: boolean };

export async function getProducts({ includeHidden = false }: Options = {}): Promise<Product[]> {
  const all = readAll();
  return includeHidden ? all : all.filter((p) => !p.hidden);
}

export async function getProductById(id: string, opts: Options = {}): Promise<Product | null> {
  return (await getProducts(opts)).find((p) => p.id === id) ?? null;
}

export async function getProductBySlug(slug: string, opts: Options = {}): Promise<Product | null> {
  return (await getProducts(opts)).find((p) => p.slug === slug) ?? null;
}

export class ConflictError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Conflict");
  }
}

function assertUnique(all: Product[], product: Product) {
  const fields: Record<string, string> = {};
  if (all.some((p) => p.id !== product.id && p.slug === product.slug)) fields.slug = "This slug is already used by another product";
  if (product.sku && all.some((p) => p.id !== product.id && p.sku?.toLowerCase() === product.sku?.toLowerCase()))
    fields.sku = "This SKU is already used by another product";
  if (Object.keys(fields).length) throw new ConflictError(fields);
}

/** Create (or restore, e.g. "Undo delete" sends the old product back with its id). */
export async function createProduct(product: Product): Promise<Product> {
  const all = readAll();
  if (all.some((p) => p.id === product.id)) throw new ConflictError({ id: "A product with this id already exists" });
  assertUnique(all, product);
  await writeAll([...all, product]);
  return product;
}

export async function updateProduct(id: string, product: Product): Promise<Product | null> {
  const all = readAll();
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const next = { ...product, id };
  assertUnique(all, next);
  await writeAll(all.map((p, n) => (n === i ? next : p)));
  return next;
}

/** Deletes one or more products; returns the removed products (for undo). */
export async function deleteProducts(ids: string[]): Promise<Product[]> {
  const all = readAll();
  const removed = all.filter((p) => ids.includes(p.id));
  if (removed.length) await writeAll(all.filter((p) => !ids.includes(p.id)));
  return removed;
}

export async function deleteProduct(id: string): Promise<Product | null> {
  return (await deleteProducts([id]))[0] ?? null;
}
