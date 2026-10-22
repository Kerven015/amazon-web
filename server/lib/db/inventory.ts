/**
 * Inventory: stock per size × colour (product_stock), manual adjustments with a reason,
 * and the stock history (stock_movements) that every change writes to:
 *   sale          an order took the units (orders.ts)
 *   cancelled     a cancelled order put them back (orders.ts)
 *   product_edit  the admin typed new numbers on the product form (products.ts)
 *   received / returned / damaged / lost / correction   adjustments made here
 */
import type { PoolClient } from "pg";
import { type Db, query, withTransaction } from "../../db/pool";
import type { L10n } from "../../../src/types";
import { getSettings } from "./settings";

export type MovementReason = "sale" | "cancelled" | "product_edit" | "received" | "returned" | "damaged" | "lost" | "correction";
export const ADJUST_REASONS = ["received", "returned", "damaged", "lost", "correction"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export type StockMovement = {
  id: number;
  productId: string;
  title: L10n | null;
  size: string;
  colour: string;
  change: number;
  quantityAfter: number;
  reason: MovementReason;
  orderId: string | null;
  note: string;
  actor: string;
  at: string;
};

export type InventoryRow = {
  productId: string;
  slug: string;
  sku: string | null;
  title: L10n;
  hidden: boolean;
  productType: string;
  size: string;
  colour: string;
  quantity: number;
  /** "out" = 0, "low" = at or below the threshold */
  level: "out" | "low" | "ok";
};

/**
 * Writes history rows for stock cells that just changed. `changes` are the deltas; the
 * quantity afterwards is read from product_stock (call this after the UPDATE, in the same transaction).
 */
export async function recordMovements(
  db: Db,
  changes: { productId: string; size: string; colour: string; change: number }[],
  meta: { reason: MovementReason; actor: string; orderId?: string | null; note?: string },
) {
  const real = changes.filter((c) => c.change !== 0);
  if (!real.length) return;
  await db.query(
    `INSERT INTO stock_movements (product_id, size, colour, change, quantity_after, reason, order_id, note, actor)
     SELECT t.product_id, t.size, t.colour, t.change, coalesce(s.quantity, 0), $5, $6, $7, $8
       FROM unnest($1::text[], $2::text[], $3::text[], $4::int[]) AS t(product_id, size, colour, change)
       LEFT JOIN product_stock s ON s.product_id = t.product_id AND s.size = t.size AND s.colour = t.colour`,
    [real.map((c) => c.productId), real.map((c) => c.size), real.map((c) => c.colour), real.map((c) => c.change), meta.reason, meta.orderId ?? null, meta.note ?? "", meta.actor],
  );
}

/** Every stock cell of every live product (hidden ones included), lowest stock first. */
export async function listInventory(): Promise<{ threshold: number; rows: InventoryRow[] }> {
  const { lowStockThreshold: threshold } = await getSettings();
  const { rows } = await query<{ product_id: string; slug: string; sku: string | null; title: L10n; hidden: boolean; product_type: string; size: string; colour: string; quantity: number }>(
    `SELECT s.product_id, p.slug, p.sku, p.data->'title' AS title, p.hidden, p.product_type, s.size, s.colour, s.quantity
       FROM product_stock s JOIN products p ON p.id = s.product_id
      WHERE p.deleted_at IS NULL
      ORDER BY s.quantity, p.position, s.size, s.colour`,
  );
  return {
    threshold,
    rows: rows.map((r) => ({
      productId: r.product_id,
      slug: r.slug,
      sku: r.sku,
      title: r.title,
      hidden: r.hidden,
      productType: r.product_type,
      size: r.size,
      colour: r.colour,
      quantity: r.quantity,
      level: r.quantity <= 0 ? "out" : r.quantity <= threshold ? "low" : "ok",
    })),
  };
}

export class StockError extends Error {
  constructor(public code: "not_found" | "negative_stock" | "wrong_direction") {
    super(code);
  }
}

/** Units in (+) for received/returned, out (−) for damaged/lost; a correction can go either way. */
export function directionOk(reason: AdjustReason, change: number) {
  if (change === 0) return false;
  if (reason === "received" || reason === "returned") return change > 0;
  if (reason === "damaged" || reason === "lost") return change < 0;
  return true;
}

/** A manual stock adjustment: changes one cell, keeps products.stock in step and records the history. */
export async function adjustStock(
  input: { productId: string; size: string; colour: string; change: number; reason: AdjustReason; note: string },
  actor: string,
  onDone?: (client: PoolClient, quantityAfter: number) => Promise<void>,
): Promise<{ quantity: number }> {
  if (!directionOk(input.reason, input.change)) throw new StockError("wrong_direction");
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ quantity: number }>(
      `SELECT s.quantity FROM product_stock s JOIN products p ON p.id = s.product_id
        WHERE s.product_id = $1 AND s.size = $2 AND s.colour = $3 AND p.deleted_at IS NULL
          FOR UPDATE OF s`,
      [input.productId, input.size, input.colour],
    );
    if (!rows[0]) throw new StockError("not_found");
    const after = rows[0].quantity + input.change;
    if (after < 0) throw new StockError("negative_stock");
    await client.query("UPDATE product_stock SET quantity = $4 WHERE product_id = $1 AND size = $2 AND colour = $3", [input.productId, input.size, input.colour, after]);
    await syncProductStock(client, [input.productId]);
    await recordMovements(client, [input], { reason: input.reason, actor, note: input.note });
    await onDone?.(client, after);
    return { quantity: after };
  });
}

/** products.stock = the sum of the product's cells (kept for sorting/filtering). */
export async function syncProductStock(db: Db, productIds: string[]) {
  await db.query(
    `UPDATE products p SET stock = (SELECT coalesce(sum(quantity), 0) FROM product_stock s WHERE s.product_id = p.id)
      WHERE p.id = ANY($1::text[])`,
    [[...new Set(productIds)]],
  );
}

/** Stock history, newest first (optionally for one product). */
export async function listMovements({ productId, before, limit = 100 }: { productId?: string; before?: number; limit?: number } = {}): Promise<StockMovement[]> {
  const { rows } = await query<{
    id: number;
    product_id: string;
    title: L10n | null;
    size: string;
    colour: string;
    change: number;
    quantity_after: number;
    reason: MovementReason;
    order_id: string | null;
    note: string;
    actor: string;
    created_at: Date;
  }>(
    `SELECT m.*, p.data->'title' AS title
       FROM stock_movements m LEFT JOIN products p ON p.id = m.product_id
      WHERE ($1::text IS NULL OR m.product_id = $1) AND ($2::bigint IS NULL OR m.id < $2)
      ORDER BY m.id DESC LIMIT $3`,
    [productId ?? null, before ?? null, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    title: r.title,
    size: r.size,
    colour: r.colour,
    change: r.change,
    quantityAfter: r.quantity_after,
    reason: r.reason,
    orderId: r.order_id,
    note: r.note,
    actor: r.actor,
    at: r.created_at.toISOString(),
  }));
}
