/**
 * Admin dashboard and sales reports — every number is a query over the real orders,
 * order_items, product_stock, users and reviews tables. Nothing is estimated.
 *
 * Definitions (the same everywhere):
 *   Cancelled orders are left out of every sales figure (they're counted separately).
 *   Gross sales   = sum of order subtotals (item prices × quantities, sale prices included)
 *   Discounts     = money off from discount codes
 *   Net sales     = gross − discounts
 *   Total         = what customers were charged: net sales + shipping + tax
 *   Average order = total ÷ orders
 * Item-level figures (by product / size / colour / category) are item price × quantity,
 * before order-level discount codes, because a code applies to the whole order.
 * There is no product cost in the data, so nothing here is profit.
 *
 * Days are counted in the admin's time zone (`tz`, an IANA name the browser sends).
 */
import { query } from "../../db/pool";
import type { L10n, OrderStatus } from "../../../src/types";
import { getSettings } from "./settings";

export function validTimeZone(tz: string | null | undefined) {
  if (!tz || tz.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

const SALES = `count(*)::int AS orders,
  coalesce(sum(o.subtotal), 0) AS gross, coalesce(sum(o.discount), 0) AS discounts,
  coalesce(sum(o.shipping), 0) AS shipping, coalesce(sum(o.tax), 0) AS tax, coalesce(sum(o.total), 0) AS total`;

type SalesRow = { orders: number; gross: number; discounts: number; shipping: number; tax: number; total: number };
const round2 = (n: number) => Math.round(n * 100) / 100;
const sales = (r: SalesRow) => ({
  orders: r.orders,
  gross: round2(r.gross),
  discounts: round2(r.discounts),
  netSales: round2(r.gross - r.discounts),
  shipping: round2(r.shipping),
  tax: round2(r.tax),
  total: round2(r.total),
  averageOrder: r.orders ? round2(r.total / r.orders) : 0,
});

/* ------------------------------ dashboard ------------------------------ */

export async function dashboard(tzInput?: string | null) {
  const tz = validTimeZone(tzInput);
  const { lowStockThreshold } = await getSettings();
  // "today" and "the last 30 days" start at local midnight in the admin's time zone
  const bounds = `date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`;

  const [today, month, statuses, series, best, recent, stock, lowList, customers, reviews] = await Promise.all([
    query<SalesRow>(`SELECT ${SALES} FROM orders o WHERE o.status <> 'cancelled' AND o.created_at >= ${bounds}`, [tz]),
    query<SalesRow & { units: number }>(
      `SELECT ${SALES}, (SELECT coalesce(sum(i.quantity), 0)::int FROM order_items i JOIN orders x ON x.id = i.order_id
                          WHERE x.status <> 'cancelled' AND x.created_at >= ${bounds} - interval '29 days') AS units
         FROM orders o WHERE o.status <> 'cancelled' AND o.created_at >= ${bounds} - interval '29 days'`,
      [tz],
    ),
    query<{ status: OrderStatus; n: number }>("SELECT status, count(*)::int AS n FROM orders GROUP BY status"),
    // One row per day for the last 14 days, including days without orders
    query<{ day: string; orders: number; total: number }>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(o.id)::int AS orders, coalesce(sum(o.total), 0) AS total
         FROM generate_series(((now() AT TIME ZONE $1)::date - 13)::timestamp, (now() AT TIME ZONE $1)::date::timestamp, interval '1 day') AS d
         LEFT JOIN orders o ON o.status <> 'cancelled' AND (o.created_at AT TIME ZONE $1)::date = d::date
        GROUP BY d ORDER BY d`,
      [tz],
    ),
    query<{ product_id: string; title: string; units: number; sales: number }>(
      `SELECT i.product_id, (array_agg(i.title ORDER BY i.id DESC))[1] AS title, sum(i.quantity)::int AS units, sum(i.quantity * i.unit_price) AS sales
         FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.status <> 'cancelled' AND o.created_at >= ${bounds} - interval '29 days'
        GROUP BY i.product_id ORDER BY units DESC, sales DESC LIMIT 5`,
      [tz],
    ),
    query<{ id: string; created_at: Date; status: OrderStatus; total: number; name: string }>(
      "SELECT o.id, o.created_at, o.status, o.total, u.name FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 6",
    ),
    query<{ out: number; low: number }>(
      `SELECT count(*) FILTER (WHERE s.quantity <= 0)::int AS out, count(*) FILTER (WHERE s.quantity > 0 AND s.quantity <= $1)::int AS low
         FROM product_stock s JOIN products p ON p.id = s.product_id WHERE p.deleted_at IS NULL`,
      [lowStockThreshold],
    ),
    query<{ product_id: string; title: L10n; size: string; colour: string; quantity: number }>(
      `SELECT s.product_id, p.data->'title' AS title, s.size, s.colour, s.quantity
         FROM product_stock s JOIN products p ON p.id = s.product_id
        WHERE p.deleted_at IS NULL AND s.quantity <= $1
        ORDER BY s.quantity, p.position LIMIT 8`,
      [lowStockThreshold],
    ),
    query<{ total: number; recent: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= ${bounds} - interval '29 days')::int AS recent FROM users`,
      [tz],
    ),
    query<{ recent: number; hidden: number }>(
      "SELECT count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS recent, count(*) FILTER (WHERE hidden_at IS NOT NULL)::int AS hidden FROM reviews",
    ),
  ]);

  const byStatus = Object.fromEntries(statuses.rows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
  return {
    timeZone: tz,
    lowStockThreshold,
    today: sales(today.rows[0]),
    last30Days: { ...sales(month.rows[0]), units: month.rows[0].units },
    ordersByStatus: byStatus,
    toPack: byStatus.placed ?? 0,
    toShip: byStatus.packed ?? 0,
    daily: series.rows.map((r) => ({ day: r.day, orders: r.orders, total: round2(r.total) })),
    bestSellers: best.rows.map((r) => ({ productId: r.product_id, title: r.title, units: r.units, sales: round2(r.sales) })),
    recentOrders: recent.rows.map((r) => ({ id: r.id, createdAt: r.created_at.toISOString(), status: r.status, total: r.total, customerName: r.name })),
    stock: { out: stock.rows[0].out, low: stock.rows[0].low, cells: lowList.rows.map((r) => ({ productId: r.product_id, title: r.title, size: r.size, colour: r.colour, quantity: r.quantity })) },
    customers: { total: customers.rows[0].total, newLast30Days: customers.rows[0].recent },
    reviews: { last7Days: reviews.rows[0].recent, hidden: reviews.rows[0].hidden },
  };
}

/* ------------------------------ reports ------------------------------ */

export type ReportGroup = "day" | "week" | "month";
export type ReportRange = { from: string; to: string; tz?: string | null; group?: ReportGroup };

/** from/to are YYYY-MM-DD (both days included) in the admin's time zone. */
function range(r: ReportRange) {
  const tz = validTimeZone(r.tz);
  return { tz, params: [r.from, r.to, tz] as unknown[] };
}
// $1 = first day, $2 = last day (inclusive), $3 = time zone
const IN_RANGE = `o.created_at >= ($1::date)::timestamp AT TIME ZONE $3 AND o.created_at < ($2::date + 1)::timestamp AT TIME ZONE $3`;

export async function salesReport(r: ReportRange) {
  const { tz, params } = range(r);
  const group = r.group ?? "day";
  const breakdown = (key: string, extraJoin = "") =>
    query<{ key: string | null; units: number; sales: number; orders: number }>(
      `SELECT ${key} AS key, sum(i.quantity)::int AS units, sum(i.quantity * i.unit_price) AS sales, count(DISTINCT o.id)::int AS orders
         FROM order_items i JOIN orders o ON o.id = i.order_id ${extraJoin}
        WHERE o.status <> 'cancelled' AND ${IN_RANGE}
        GROUP BY 1 ORDER BY sales DESC, units DESC`,
      params,
    );

  const [summary, cancelled, units, series, byProduct, bySize, byColour, byCategory, byCode] = await Promise.all([
    query<SalesRow>(`SELECT ${SALES} FROM orders o WHERE o.status <> 'cancelled' AND ${IN_RANGE}`, params),
    query<{ orders: number; total: number }>(`SELECT count(*)::int AS orders, coalesce(sum(o.total), 0) AS total FROM orders o WHERE o.status = 'cancelled' AND ${IN_RANGE}`, params),
    query<{ units: number }>(`SELECT coalesce(sum(i.quantity), 0)::int AS units FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'cancelled' AND ${IN_RANGE}`, params),
    query<SalesRow & { period: string }>(
      `SELECT to_char(p, 'YYYY-MM-DD') AS period, ${SALES}
         FROM generate_series(date_trunc('${group}', $1::date::timestamp), date_trunc('${group}', $2::date::timestamp), interval '1 ${group}') AS p
         LEFT JOIN orders o ON o.status <> 'cancelled' AND ${IN_RANGE}
                           AND date_trunc('${group}', o.created_at AT TIME ZONE $3) = p
        GROUP BY p ORDER BY p`,
      params,
    ),
    query<{ product_id: string; title: string; sku: string | null; units: number; sales: number; orders: number }>(
      `SELECT i.product_id, (array_agg(i.title ORDER BY i.id DESC))[1] AS title, (array_agg(i.sku ORDER BY i.id DESC))[1] AS sku,
              sum(i.quantity)::int AS units, sum(i.quantity * i.unit_price) AS sales, count(DISTINCT o.id)::int AS orders
         FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.status <> 'cancelled' AND ${IN_RANGE}
        GROUP BY i.product_id ORDER BY sales DESC, units DESC`,
      params,
    ),
    breakdown("nullif(i.size, '')"),
    breakdown("nullif(i.colour, '')"),
    // The product's current type; products deleted since have none
    breakdown("p.product_type", "LEFT JOIN products p ON p.id = i.product_id"),
    query<{ code: string; orders: number; discounts: number }>(
      `SELECT o.discount_code AS code, count(*)::int AS orders, sum(o.discount) AS discounts
         FROM orders o WHERE o.status <> 'cancelled' AND o.discount_code IS NOT NULL AND ${IN_RANGE}
        GROUP BY 1 ORDER BY discounts DESC`,
      params,
    ),
  ]);

  const rows = (x: { rows: { key: string | null; units: number; sales: number; orders: number }[] }) => x.rows.map((r) => ({ key: r.key, units: r.units, sales: round2(r.sales), orders: r.orders }));
  return {
    from: r.from,
    to: r.to,
    timeZone: tz,
    group,
    summary: { ...sales(summary.rows[0]), units: units.rows[0].units, cancelledOrders: cancelled.rows[0].orders, cancelledTotal: round2(cancelled.rows[0].total) },
    series: series.rows.map((s) => ({ period: s.period, ...sales(s) })),
    byProduct: byProduct.rows.map((p) => ({ productId: p.product_id, title: p.title, sku: p.sku, units: p.units, sales: round2(p.sales), orders: p.orders })),
    bySize: rows(bySize),
    byColour: rows(byColour),
    byCategory: rows(byCategory),
    byDiscountCode: byCode.rows.map((c) => ({ code: c.code, orders: c.orders, discounts: round2(c.discounts) })),
  };
}

/* ------------------------------ CSV ------------------------------ */

/** One CSV cell: quoted, and text that a spreadsheet would run as a formula is prefixed with '. */
export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** Orders in the range, one per line (no addresses or emails — only what the numbers need). */
export async function ordersCsv(r: ReportRange) {
  const { params } = range(r);
  const { rows } = await query<{
    id: string;
    created_at: Date;
    status: string;
    items: number;
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    discount_code: string | null;
    delivery_option: string;
    country: string;
  }>(
    `SELECT o.id, o.created_at, o.status, (SELECT coalesce(sum(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS items,
            o.subtotal, o.discount, o.shipping, o.tax, o.total, o.discount_code, o.delivery_option, o.address->>'country' AS country
       FROM orders o WHERE ${IN_RANGE} ORDER BY o.created_at`,
    params,
  );
  return toCsv([
    ["order", "created_at", "status", "items", "subtotal", "discount", "shipping", "tax", "total", "discount_code", "delivery", "country"],
    ...rows.map((o) => [o.id, o.created_at.toISOString(), o.status, o.items, o.subtotal.toFixed(2), o.discount.toFixed(2), o.shipping.toFixed(2), o.tax.toFixed(2), o.total.toFixed(2), o.discount_code, o.delivery_option, o.country]),
  ]);
}

/** Sales per product, size and colour in the range (cancelled orders left out). */
export async function productsCsv(r: ReportRange) {
  const { params } = range(r);
  const { rows } = await query<{ product_id: string; sku: string | null; title: string; size: string; colour: string; units: number; sales: number; orders: number }>(
    `SELECT i.product_id, (array_agg(i.sku ORDER BY i.id DESC))[1] AS sku, (array_agg(i.title ORDER BY i.id DESC))[1] AS title,
            i.size, i.colour, sum(i.quantity)::int AS units, sum(i.quantity * i.unit_price) AS sales, count(DISTINCT o.id)::int AS orders
       FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.status <> 'cancelled' AND ${IN_RANGE}
      GROUP BY i.product_id, i.size, i.colour ORDER BY sales DESC`,
    params,
  );
  return toCsv([["product_id", "sku", "product", "size", "colour", "units", "item_sales", "orders"], ...rows.map((p) => [p.product_id, p.sku, p.title, p.size, p.colour, p.units, p.sales.toFixed(2), p.orders])]);
}
