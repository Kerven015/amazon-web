/**
 * Orders: placing (one transaction, stock locked with SELECT … FOR UPDATE), reading
 * (only the customer's own) and the admin's list / status changes.
 *
 * The server recalculates everything — unit prices from the database, the discount
 * from the code, shipping from siteConfig.deliveryOptions, tax and total — and ignores
 * any price the browser might send.
 */
import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import type { OrderInput } from "../../../src/lib/account-schema";
import { sellers } from "../../../src/lib/mock-data/sellers";
import { buildTracking } from "../../../src/lib/order-tracking";
import { computeTotals, deliveryDates, deliveryPrice, discountAmount, discountPercent, sizePrice, type DeliveryId } from "../../../src/lib/pricing";
import type { Address, Order, OrderStatus, ProductRecord } from "../../../src/types";
import { type Db, query, withTransaction } from "../../db/pool";
import { env } from "../../env";
import { addressFromRow, type AddressRow } from "./account";

/**
 * Payment is still a demo, so an order costs nothing to place — but it does take stock.
 * These caps stop one account from ordering out the whole shop (F-02):
 *   ORDER_MAX_OPEN     orders still "placed" (not yet packed/cancelled) per customer, default 3
 *   ORDER_MAX_PER_DAY  orders per customer in 24 hours, default 10
 *   ORDER_MAX_UNITS    items in one order, default 50 (and at most 10 of one size/colour)
 */
const limit = (name: string, fallback: number) => {
  const n = Number(env(name));
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
export const orderLimits = () => ({ open: limit("ORDER_MAX_OPEN", 3), perDay: limit("ORDER_MAX_PER_DAY", 10), units: limit("ORDER_MAX_UNITS", 50), perLine: 10 });

export class OrderError extends Error {
  constructor(
    public code: "out_of_stock" | "invalid_discount" | "address_not_found" | "too_many_orders" | "order_too_large",
    public lines: OutOfStockLine[] = [],
  ) {
    super(code);
  }
}

export type OutOfStockLine = { productId: string; size?: string; colour?: string; requested: number; available: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const realImage = (src?: string) => (src && !src.startsWith("data:") ? src : "");

type OrderRow = {
  id: string;
  user_id: string;
  email: string;
  status: OrderStatus;
  delivery_option: string;
  payment_method: string;
  address: Address;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  discount_code: string | null;
  estimated_delivery: Date;
  created_at: Date;
  customer_name?: string;
  items: { product_id: string; title: string; image: string; size: string; colour: string; quantity: number; unit_price: number; list_price: number | null }[] | null;
  events: { status: OrderStatus; at: string }[] | null;
};

const ORDER_SELECT = `
  SELECT o.*, u.name AS customer_name,
         (SELECT json_agg(json_build_object('product_id', i.product_id, 'title', i.title, 'image', i.image, 'size', i.size,
                   'colour', i.colour, 'quantity', i.quantity, 'unit_price', i.unit_price, 'list_price', i.list_price) ORDER BY i.id)
            FROM order_items i WHERE i.order_id = o.id) AS items,
         (SELECT json_agg(json_build_object('status', e.status, 'at', e.at) ORDER BY e.at, e.id)
            FROM order_events e WHERE e.order_id = o.id) AS events
    FROM orders o JOIN users u ON u.id = o.user_id`;

function toOrder(row: OrderRow): Order {
  const dates: Partial<Record<OrderStatus, string>> = {};
  for (const e of row.events ?? []) dates[e.status] = new Date(e.at).toISOString();
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    status: row.status,
    items: (row.items ?? []).map((i) => ({
      productId: i.product_id,
      title: i.title,
      image: i.image,
      price: Number(i.unit_price),
      quantity: i.quantity,
      variant: { size: i.size || undefined, color: i.colour || undefined },
      sellerName: sellers[0]?.name ?? "Vendora",
    })),
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    tax: row.tax,
    total: row.total,
    address: row.address,
    paymentMethod: row.payment_method,
    deliveryOption: row.delivery_option,
    estimatedDelivery: row.estimated_delivery.toISOString(),
    tracking: buildTracking(row.status, dates),
    customerName: row.customer_name,
  };
}

/** One of the customer's orders (anyone else's → null, which the API turns into 404). */
export async function getOrder(userId: string, id: string, db: Db = { query }): Promise<Order | null> {
  const { rows } = await db.query<OrderRow>(`${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2`, [id, userId]);
  return rows[0] ? toOrder(rows[0]) : null;
}

export async function listOrders(userId: string): Promise<Order[]> {
  const { rows } = await query<OrderRow>(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT 200`, [userId]);
  return rows.map(toOrder);
}

/* ------------------------------ placing ------------------------------ */

type Line = { productId: string; size?: string; colour?: string; quantity: number };

/** Same line twice in one request → one line with the quantities added up. */
function mergeLines(items: Line[]): Line[] {
  const map = new Map<string, Line>();
  for (const i of items) {
    const key = [i.productId, i.size ?? "", i.colour ?? ""].join("|");
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, quantity: prev.quantity + i.quantity } : { ...i });
  }
  return [...map.values()];
}

export async function placeOrder(user: { id: string; email: string }, input: OrderInput): Promise<Order> {
  return withTransaction(async (client) => {
    const lines = mergeLines(input.items);
    const caps = orderLimits();

    // 0. Abuse limits. Locking the customer's row makes two simultaneous checkouts by the
    //    same account wait for each other, so the counts below can't be raced.
    if (lines.some((l) => l.quantity > caps.perLine) || lines.reduce((n, l) => n + l.quantity, 0) > caps.units) throw new OrderError("order_too_large");
    await client.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [user.id]);
    const { rows: counts } = await client.query<{ open: number; day: number }>(
      `SELECT count(*) FILTER (WHERE status = 'placed')::int AS open,
              count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day
         FROM orders WHERE user_id = $1`,
      [user.id],
    );
    if (counts[0].open >= caps.open || counts[0].day >= caps.perDay) throw new OrderError("too_many_orders");

    // 1. Products and prices — from the database only
    const { rows: products } = await client.query<{ id: string; data: ProductRecord }>(
      "SELECT id, data FROM products WHERE id = ANY($1::text[]) AND deleted_at IS NULL AND NOT hidden",
      [[...new Set(lines.map((l) => l.productId))]],
    );
    const byId = new Map(products.map((p) => [p.id, p.data]));

    const problems: OutOfStockLine[] = [];
    const priced = lines.flatMap((line) => {
      const product = byId.get(line.productId);
      const size = product && (line.size ? product.sizes.find((s) => s.name === line.size) : product.sizes.length === 1 ? product.sizes[0] : undefined);
      const colours = product?.variants.colors ?? [];
      const colourOk = !colours.length || colours.some((c) => c.name === line.colour);
      if (!product || !size || !colourOk || product.stockStatus === "out") {
        problems.push({ ...line, requested: line.quantity, available: 0 });
        return [];
      }
      const { price, listPrice } = sizePrice(size);
      const colour = colours.find((c) => c.name === line.colour);
      return [{ line, product, sizeName: size.name, stockColour: colours.length ? line.colour! : "default", price, listPrice, image: realImage(colour?.image) || realImage(product.images[0]?.src) }];
    });

    // 2. Lock the stock cells (in a fixed order, so two checkouts can't deadlock) and check them
    if (priced.length) {
      const { rows: cells } = await client.query<{ product_id: string; size: string; colour: string; quantity: number }>(
        `SELECT s.product_id, s.size, s.colour, s.quantity
           FROM product_stock s
           JOIN unnest($1::text[], $2::text[], $3::text[]) AS t(product_id, size, colour)
             ON s.product_id = t.product_id AND s.size = t.size AND s.colour = t.colour
          ORDER BY s.product_id, s.size, s.colour
            FOR UPDATE OF s`,
        [priced.map((p) => p.line.productId), priced.map((p) => p.sizeName), priced.map((p) => p.stockColour)],
      );
      const have = new Map(cells.map((c) => [`${c.product_id}|${c.size}|${c.colour}`, c.quantity]));
      for (const p of priced) {
        const available = have.get(`${p.line.productId}|${p.sizeName}|${p.stockColour}`) ?? 0;
        if (available < p.line.quantity) problems.push({ ...p.line, requested: p.line.quantity, available });
      }
    }
    if (problems.length) throw new OrderError("out_of_stock", problems);

    // 3. Address: one of the customer's own, or the one typed at checkout (stored as a copy)
    let address: Address;
    if (input.addressId) {
      const { rows } = await client.query<AddressRow>("SELECT * FROM addresses WHERE id = $1 AND user_id = $2", [input.addressId, user.id]);
      if (!rows[0]) throw new OrderError("address_not_found");
      address = addressFromRow(rows[0]);
    } else {
      address = { id: "order", ...input.address!, line2: input.address!.line2 || undefined };
    }

    // 4. Totals
    const subtotal = round2(priced.reduce((n, p) => n + p.price * p.line.quantity, 0));
    if (input.discountCode && !discountPercent(input.discountCode)) throw new OrderError("invalid_discount");
    const discount = discountAmount(subtotal, input.discountCode);
    const option = input.deliveryOption as DeliveryId;
    const totals = computeTotals(subtotal, deliveryPrice(option, Math.max(0, subtotal - discount)), discount);
    const placedAt = new Date();
    const payment = input.payment.method === "card" ? `card:Card:${input.payment.last4 ?? "0000"}` : "wallet";

    // 5. Take the stock
    await client.query(
      `UPDATE product_stock s SET quantity = s.quantity - t.qty
         FROM unnest($1::text[], $2::text[], $3::text[], $4::int[]) AS t(product_id, size, colour, qty)
        WHERE s.product_id = t.product_id AND s.size = t.size AND s.colour = t.colour`,
      [priced.map((p) => p.line.productId), priced.map((p) => p.sizeName), priced.map((p) => p.stockColour), priced.map((p) => p.line.quantity)],
    );
    await client.query(
      `UPDATE products p SET stock = (SELECT coalesce(sum(quantity), 0) FROM product_stock s WHERE s.product_id = p.id)
        WHERE p.id = ANY($1::text[])`,
      [[...new Set(priced.map((p) => p.line.productId))]],
    );

    // 6. The order, its lines and the first tracking event
    const id = await insertOrder(client, {
      userId: user.id,
      email: user.email,
      option,
      payment,
      address,
      totals,
      code: discount > 0 ? input.discountCode!.trim().toUpperCase() : null,
      eta: deliveryDates(option, placedAt).latest,
      placedAt,
    });
    await client.query(
      `INSERT INTO order_items (order_id, product_id, title, image, size, colour, quantity, unit_price, list_price)
       SELECT $1, product_id, title, image, size, colour, quantity, unit_price, list_price
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[], $8::numeric[], $9::numeric[])
           AS t(product_id, title, image, size, colour, quantity, unit_price, list_price)`,
      [
        id,
        priced.map((p) => p.line.productId),
        priced.map((p) => p.product.title.en),
        priced.map((p) => p.image),
        priced.map((p) => p.line.size ?? ""),
        priced.map((p) => p.line.colour ?? ""),
        priced.map((p) => p.line.quantity),
        priced.map((p) => p.price),
        priced.map((p) => p.listPrice ?? null),
      ],
    );
    await client.query("INSERT INTO order_events (order_id, status, at) VALUES ($1, 'placed', $2)", [id, placedAt]);

    // 7. The bag is now empty (in the account; the browser clears its copy)
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [user.id]);

    return (await getOrder(user.id, id, client))!;
  });
}

/** "VD-123456" — retried on the (rare) clash with an existing number. */
async function insertOrder(
  client: PoolClient,
  o: { userId: string; email: string; option: string; payment: string; address: Address; totals: ReturnType<typeof computeTotals>; code: string | null; eta: Date; placedAt: Date },
) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = `VD-${randomInt(100000, 1000000)}`;
    const { rowCount } = await client.query(
      `INSERT INTO orders (id, user_id, email, status, delivery_option, payment_method, address, subtotal, discount, shipping, tax, total,
                           discount_code, estimated_delivery, created_at)
       VALUES ($1, $2, $3, 'placed', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO NOTHING`,
      [id, o.userId, o.email, o.option, o.payment, JSON.stringify(o.address), o.totals.subtotal, o.totals.discount, o.totals.shipping, o.totals.tax, o.totals.total, o.code, o.eta, o.placedAt],
    );
    if (rowCount === 1) return id;
  }
  throw new Error("Couldn't allocate an order number");
}

/* ------------------------------ admin ------------------------------ */

export async function adminListOrders(limit = 500): Promise<Order[]> {
  const { rows } = await query<OrderRow>(`${ORDER_SELECT} ORDER BY o.created_at DESC LIMIT $1`, [limit]);
  return rows.map((r) => ({ ...toOrder(r), email: r.email }) as Order & { email: string });
}

/**
 * Moves an order to a new status and adds a tracking event.
 * Cancelling puts the items back in stock; a cancelled order can't be reopened.
 * Returns null when the order doesn't exist.
 */
export async function adminSetStatus(id: string, status: OrderStatus): Promise<(Order & { email: string }) | null | "cancelled"> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ status: OrderStatus; user_id: string; email: string }>("SELECT status, user_id, email FROM orders WHERE id = $1 FOR UPDATE", [id]);
    const current = rows[0];
    if (!current) return null;
    if (current.status === "cancelled") return "cancelled";
    if (current.status !== status) {
      await client.query("UPDATE orders SET status = $2 WHERE id = $1", [id, status]);
      await client.query("INSERT INTO order_events (order_id, status) VALUES ($1, $2)", [id, status]);
      if (status === "cancelled") {
        // Back in stock: the same cells the order took (cells removed by the admin since are skipped)
        await client.query(
          `UPDATE product_stock s SET quantity = s.quantity + i.quantity
             FROM order_items i JOIN products p ON p.id = i.product_id
            WHERE i.order_id = $1 AND s.product_id = i.product_id
              AND s.size = CASE WHEN i.size = '' THEN (p.data->'sizes'->0->>'name') ELSE i.size END
              AND s.colour = CASE WHEN i.colour = '' THEN 'default' ELSE i.colour END`,
          [id],
        );
        await client.query(
          `UPDATE products p SET stock = (SELECT coalesce(sum(quantity), 0) FROM product_stock s WHERE s.product_id = p.id)
            WHERE p.id IN (SELECT product_id FROM order_items WHERE order_id = $1)`,
          [id],
        );
      }
    }
    const order = await getOrder(current.user_id, id, client);
    return order ? { ...order, email: current.email } : null;
  });
}
