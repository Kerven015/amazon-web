/**
 * Product data layer — the ONLY place that knows where products are stored.
 *
 * PostgreSQL (server/db/migrations/001_init.sql):
 *   products       one row per product; `data` jsonb holds the ProductRecord as the admin edits it
 *   product_stock  units per size × colour — the stock orders decrease (source of truth)
 *   reviews        reviewCount and rating are always computed from here (reviews the admin hid are left out)
 *
 * The function names and return shapes are the same as the old JSON-file version,
 * so server/app.ts and the browser didn't change.
 *
 * Delete + undo: deleting sets deleted_at (the product disappears everywhere at once);
 * "Undo" within 10 minutes clears it again, so reviews, stock and bag/wishlist entries
 * come back exactly as they were. Rows deleted longer ago are purged for good on the next
 * delete/restore (and at start-up), which also removes their reviews, stock and saved entries.
 */
import type { PoolClient } from "pg";
import type { ProductRecord as Product, Review } from "../../../src/types";
import { type Db, query, withTransaction } from "../../db/pool";
import { recordMovements, syncProductStock } from "./inventory";

export const UNDO_MINUTES = 10;

type Options = { includeHidden?: boolean };

type Row = {
  id: string;
  slug: string;
  sku: string | null;
  hidden: boolean;
  product_type: string;
  price: number;
  data: Omit<Product, "reviews">;
  stock_rows: { size: string; colour: string; quantity: number }[] | null;
  review_rows: ReviewRow[] | null;
};

type ReviewRow = {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  size_bought: string | null;
  colour_bought: string | null;
  verified: boolean;
  helpful: number;
  created_at: string;
};

/** One query: products + their stock cells + their reviews (newest first). */
const SELECT = `
  SELECT p.id, p.slug, p.sku, p.hidden, p.product_type, p.price, p.data,
         (SELECT json_agg(json_build_object('size', s.size, 'colour', s.colour, 'quantity', s.quantity))
            FROM product_stock s WHERE s.product_id = p.id) AS stock_rows,
         (SELECT json_agg(json_build_object(
                   'id', r.id, 'author', r.author, 'rating', r.rating, 'title', r.title, 'body', r.body,
                   'size_bought', r.size_bought, 'colour_bought', r.colour_bought, 'verified', r.verified,
                   'helpful', r.helpful, 'created_at', r.created_at)
                 ORDER BY r.created_at DESC, r.id)
            FROM reviews r WHERE r.product_id = p.id AND r.hidden_at IS NULL) AS review_rows
    FROM products p
   WHERE p.deleted_at IS NULL`;

function toReview(productId: string, r: ReviewRow): Review {
  return {
    id: r.id,
    productId,
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    date: new Date(r.created_at).toISOString().slice(0, 10),
    verified: r.verified,
    helpful: r.helpful,
    ...(r.size_bought ? { sizeBought: r.size_bought } : {}),
    ...(r.colour_bought ? { colourBought: r.colour_bought } : {}),
  };
}

/** Database row → the ProductRecord the API has always returned. */
function toProduct(row: Row): Product {
  const cells = row.stock_rows ?? [];
  // Stock per size/colour comes from product_stock (orders decrease it there)
  const sizes = row.data.sizes.map((s) => {
    const stock: Record<string, number> = {};
    for (const key of Object.keys(s.stock)) stock[key] = 0;
    for (const c of cells) if (c.size === s.name) stock[c.colour] = c.quantity;
    return { ...s, stock };
  });
  const reviews = (row.review_rows ?? []).map((r) => toReview(row.id, r));
  const rating = reviews.length ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  return {
    ...row.data,
    id: row.id,
    slug: row.slug,
    sku: row.sku ?? undefined,
    hidden: row.hidden || undefined,
    productType: row.product_type,
    price: row.price,
    sizes,
    stock: cells.reduce((n, c) => n + c.quantity, 0),
    reviews,
    reviewCount: reviews.length,
    rating,
  };
}

export async function getProducts({ includeHidden = false }: Options = {}): Promise<Product[]> {
  const { rows } = await query<Row>(`${SELECT} ${includeHidden ? "" : "AND NOT p.hidden"} ORDER BY p.position`);
  return rows.map(toProduct);
}

export async function getProductById(id: string, { includeHidden = false }: Options = {}, db: Db = { query }): Promise<Product | null> {
  const { rows } = await db.query<Row>(`${SELECT} AND p.id = $1 ${includeHidden ? "" : "AND NOT p.hidden"}`, [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function getProductBySlug(slug: string, { includeHidden = false }: Options = {}): Promise<Product | null> {
  const { rows } = await query<Row>(`${SELECT} AND p.slug = $1 ${includeHidden ? "" : "AND NOT p.hidden"}`, [slug]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export class ConflictError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Conflict");
  }
}

/** Postgres unique violation (23505) → the same field messages the admin form already shows. */
function asConflict(err: unknown): never {
  const e = err as { code?: string; constraint?: string };
  if (e.code === "23505") {
    if (e.constraint === "products_pkey") throw new ConflictError({ id: "A product with this id already exists" });
    if (e.constraint === "products_slug_key") throw new ConflictError({ slug: "This slug is already used by another product" });
    if (e.constraint === "products_sku_key") throw new ConflictError({ sku: "This SKU is already used by another product" });
  }
  throw err;
}

/** What goes into the jsonb column: everything except the parts that have their own tables. */
function dataFor(product: Product) {
  const { reviews: _reviews, rating: _rating, reviewCount: _count, ...rest } = product;
  return rest;
}

/** Replaces the stock cells with the sizes[].stock the admin saved; the differences go into the stock history. */
async function writeStock(client: PoolClient, product: Product, actor: string) {
  const next = new Map<string, { size: string; colour: string; quantity: number }>();
  for (const s of product.sizes) {
    for (const [colour, qty] of Object.entries(s.stock)) next.set(`${s.name}|${colour}`, { size: s.name, colour, quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
  }
  const { rows: before } = await client.query<{ size: string; colour: string; quantity: number }>(
    "DELETE FROM product_stock WHERE product_id = $1 RETURNING size, colour, quantity",
    [product.id],
  );
  const cells = [...next.values()];
  await client.query(
    `INSERT INTO product_stock (product_id, size, colour, quantity)
     SELECT $1, size, colour, quantity FROM unnest($2::text[], $3::text[], $4::int[]) AS t(size, colour, quantity)`,
    [product.id, cells.map((c) => c.size), cells.map((c) => c.colour), cells.map((c) => c.quantity)],
  );
  await syncProductStock(client, [product.id]);
  const old = new Map(before.map((c) => [`${c.size}|${c.colour}`, c.quantity]));
  const changes = cells.map((c) => ({ productId: product.id, size: c.size, colour: c.colour, change: c.quantity - (old.get(`${c.size}|${c.colour}`) ?? 0) }));
  // Cells removed from the form (a size or colour taken away)
  for (const c of before) if (!next.has(`${c.size}|${c.colour}`)) changes.push({ productId: product.id, size: c.size, colour: c.colour, change: -c.quantity });
  await recordMovements(client, changes, { reason: "product_edit", actor });
}

const columns = (p: Product) => [p.id, p.slug, p.sku || null, !!p.hidden, p.productType, p.price, JSON.stringify(dataFor(p)), p.createdAt || new Date().toISOString()];

/** Create a product (reviews are not taken from the request — they live in their own table). */
export async function createProduct(product: Product, actor = "admin"): Promise<Product> {
  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO products (id, slug, sku, hidden, product_type, price, data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        columns(product),
      );
      await writeStock(client, product, actor);
    });
  } catch (err) {
    asConflict(err);
  }
  return (await getProductById(product.id, { includeHidden: true }))!;
}

/**
 * Saves the admin form. The stock cells are replaced with the quantities on the form,
 * so the admin stays the one who sets stock (orders placed while the form was open are
 * already reflected in the numbers the form loaded, unless it was open a long time).
 */
export async function updateProduct(id: string, product: Product, actor = "admin"): Promise<Product | null> {
  const next = { ...product, id };
  let found = false;
  try {
    await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE products SET slug = $2, sku = $3, hidden = $4, product_type = $5, price = $6, data = $7, created_at = $8
          WHERE id = $1 AND deleted_at IS NULL`,
        columns(next),
      );
      found = res.rowCount === 1;
      if (found) await writeStock(client, next, actor);
    });
  } catch (err) {
    asConflict(err);
  }
  return found ? getProductById(id, { includeHidden: true }) : null;
}

/** Permanently removes products that left the undo window. */
export async function purgeDeleted(db: Db = { query }) {
  await db.query(`DELETE FROM products WHERE deleted_at < now() - make_interval(mins => $1)`, [UNDO_MINUTES]);
}

/** Deletes one or more products (undo possible for 10 minutes); returns the removed products. */
export async function deleteProducts(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  await purgeDeleted();
  const { rows } = await query<Row>(`${SELECT} AND p.id = ANY($1::text[])`, [ids]);
  if (rows.length) await query("UPDATE products SET deleted_at = now() WHERE id = ANY($1::text[]) AND deleted_at IS NULL", [rows.map((r) => r.id)]);
  return rows.map(toProduct);
}

export async function deleteProduct(id: string): Promise<Product | null> {
  return (await deleteProducts([id]))[0] ?? null;
}

/** "Undo delete": brings back products deleted less than 10 minutes ago. Returns the restored ids. */
export async function restoreProducts(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  await purgeDeleted();
  try {
    const { rows } = await query<{ id: string }>(
      `UPDATE products SET deleted_at = NULL
        WHERE id = ANY($1::text[]) AND deleted_at >= now() - make_interval(mins => $2)
        RETURNING id`,
      [ids, UNDO_MINUTES],
    );
    return rows.map((r) => r.id);
  } catch (err) {
    // Someone reused the slug / SKU in the meantime
    asConflict(err);
  }
}
