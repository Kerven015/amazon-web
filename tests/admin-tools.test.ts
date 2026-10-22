/**
 * Admin tools: order status rules, stock history and adjustments, review moderation,
 * dashboard / report numbers (checked against the database), CSV export and the activity log.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { csvCell } from "../server/lib/db/reports";
import { adminLogin, orderBody, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
let admin: string;
before(async () => {
  t = await startServer();
  await t.db.query("UPDATE product_stock SET quantity = 100");
  await t.db.query("UPDATE products p SET stock = (SELECT sum(quantity) FROM product_stock s WHERE s.product_id = p.id)");
  admin = await adminLogin(t);
});
after(async () => t?.close());

const CELL = { productId: "p14", size: "Face cloth", colour: "Chalk" };
const stockOf = async () => (await t.db.query("SELECT quantity FROM product_stock WHERE product_id = $1 AND size = $2 AND colour = $3", [CELL.productId, CELL.size, CELL.colour])).rows[0].quantity as number;
const today = () => new Date().toISOString().slice(0, 10);
const shift = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** A new customer places one order; returns its id. */
async function newOrder(quantity = 1) {
  const c = await registerCustomer(t);
  const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ items: [{ ...CELL, quantity }] }) });
  assert.equal(r.status, 201, r.text);
  return r.json.id as string;
}
const setStatus = (id: string, status: string) => t.api(`/api/admin/orders/${id}/status`, { method: "PATCH", cookie: admin, body: { status } });
const lastAudit = async (action: string) => (await t.db.query("SELECT * FROM admin_audit_log WHERE action = $1 ORDER BY id DESC LIMIT 1", [action])).rows[0];

describe("access", () => {
  const routes: [string, string][] = [
    ["GET", "/api/admin/dashboard"],
    ["GET", "/api/admin/orders/VD-123456"],
    ["PATCH", "/api/admin/orders/VD-123456/shipment"],
    ["GET", "/api/admin/inventory"],
    ["GET", "/api/admin/inventory/movements"],
    ["POST", "/api/admin/inventory/adjust"],
    ["GET", "/api/admin/settings"],
    ["PUT", "/api/admin/settings"],
    ["GET", "/api/admin/reviews"],
    ["POST", "/api/admin/reviews/x/hide"],
    ["DELETE", "/api/admin/reviews/x"],
    ["GET", "/api/admin/reports/sales?from=2026-01-01&to=2026-01-31"],
    ["GET", "/api/admin/reports/export?type=orders&from=2026-01-01&to=2026-01-31"],
    ["GET", "/api/admin/activity"],
  ];
  test("every admin tool needs an admin session (customers too get 401)", async () => {
    const c = await registerCustomer(t);
    for (const [method, path] of routes) {
      for (const cookie of [undefined, c.cookie]) {
        const r = await t.api(path, { method, cookie, body: method === "GET" ? undefined : {} });
        assert.equal(r.status, 401, `${method} ${path}`);
      }
    }
  });

  test("changes from another site are refused", async () => {
    const before = await stockOf();
    const r = await t.api("/api/admin/inventory/adjust", { cookie: admin, body: { ...CELL, change: 5, reason: "received" }, headers: { Origin: "https://evil.example" } });
    assert.equal(r.status, 403);
    assert.equal(await stockOf(), before);
  });
});

describe("order status", () => {
  test("moves forward only, and is logged", async () => {
    const id = await newOrder();
    assert.equal((await setStatus(id, "packed")).status, 200);
    const back = await setStatus(id, "placed");
    assert.equal(back.status, 409);
    assert.equal(back.json.error, "invalid_transition");
    // Steps may be skipped
    const shipped = await setStatus(id, "shipped");
    assert.equal(shipped.status, 200);
    assert.equal(shipped.json.status, "shipped");
    const audit = await lastAudit("order.status");
    assert.equal(audit.entity_id, id);
    assert.deepEqual(audit.details, { from: "packed", to: "shipped" });
    assert.equal(audit.actor, "admin");
    const events = (await t.db.query("SELECT status FROM order_events WHERE order_id = $1 ORDER BY id", [id])).rows.map((r) => r.status);
    assert.deepEqual(events, ["placed", "packed", "shipped"]);
  });

  test("shipped orders can't be cancelled; delivered and cancelled orders are final", async () => {
    const shipped = await newOrder();
    await setStatus(shipped, "shipped");
    assert.equal((await setStatus(shipped, "cancelled")).status, 409);
    await setStatus(shipped, "delivered");
    assert.equal((await setStatus(shipped, "out_for_delivery")).status, 409);
    const cancelled = await newOrder();
    assert.equal((await setStatus(cancelled, "cancelled")).status, 200);
    assert.equal((await setStatus(cancelled, "packed")).status, 409);
  });

  test("selling and cancelling are both in the stock history", async () => {
    const before = await stockOf();
    const id = await newOrder(2);
    assert.equal(await stockOf(), before - 2);
    const sale = (await t.db.query("SELECT * FROM stock_movements WHERE order_id = $1 AND reason = 'sale'", [id])).rows[0];
    assert.equal(sale.change, -2);
    assert.equal(sale.quantity_after, before - 2);
    await setStatus(id, "cancelled");
    assert.equal(await stockOf(), before);
    const back = (await t.db.query("SELECT * FROM stock_movements WHERE order_id = $1 AND reason = 'cancelled'", [id])).rows[0];
    assert.equal(back.change, 2);
    assert.equal(back.quantity_after, before);
    assert.equal(back.actor, "admin");
  });

  test("order detail has the SKU; shipment details are saved, validated and logged", async () => {
    const id = await newOrder();
    const sku = (await t.db.query("SELECT sku FROM products WHERE id = 'p14'")).rows[0].sku;
    const detail = await t.api(`/api/admin/orders/${id}`, { cookie: admin });
    assert.equal(detail.status, 200);
    assert.equal(detail.json.items[0].sku, sku);
    const bad = await t.api(`/api/admin/orders/${id}/shipment`, { method: "PATCH", cookie: admin, body: { carrier: "UPS", trackingNumber: "<script>" } });
    assert.equal(bad.status, 422);
    const ok = await t.api(`/api/admin/orders/${id}/shipment`, { method: "PATCH", cookie: admin, body: { carrier: "UPS", trackingNumber: "1Z 999 AA1" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.trackingNumber, "1Z 999 AA1");
    assert.equal((await lastAudit("order.shipment")).entity_id, id);
    assert.equal((await t.api("/api/admin/orders/VD-000001", { cookie: admin })).status, 404);
  });

  test("the order list can be searched and filtered", async () => {
    const id = await newOrder();
    const byId = await t.api(`/api/admin/orders?q=${id}`, { cookie: admin });
    assert.deepEqual(byId.json.map((o: { id: string }) => o.id), [id]);
    const cancelled = await t.api("/api/admin/orders?status=cancelled", { cookie: admin });
    assert.ok(cancelled.json.length > 0 && cancelled.json.every((o: { status: string }) => o.status === "cancelled"));
    const open = await t.api("/api/admin/orders?status=open&sort=total_asc", { cookie: admin });
    assert.ok(open.json.every((o: { status: string }) => o.status === "placed" || o.status === "packed"));
    assert.equal((await t.api("/api/admin/orders?status=lost", { cookie: admin })).status, 422);
    assert.equal((await t.api("/api/admin/orders?q=%25", { cookie: admin })).json.length, 0, "% matches literally");
  });
});

describe("inventory", () => {
  test("received stock is added, recorded and logged", async () => {
    const before = await stockOf();
    const r = await t.api("/api/admin/inventory/adjust", { cookie: admin, body: { ...CELL, change: 5, reason: "received", note: "Delivery #12" } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.quantity, before + 5);
    assert.equal(await stockOf(), before + 5);
    const total = (await t.db.query("SELECT stock, (SELECT sum(quantity) FROM product_stock WHERE product_id = 'p14')::int AS cells FROM products WHERE id = 'p14'")).rows[0];
    assert.equal(total.stock, total.cells, "products.stock follows the cells");
    const m = (await t.api("/api/admin/inventory/movements?productId=p14", { cookie: admin })).json[0];
    assert.equal(m.reason, "received");
    assert.equal(m.change, 5);
    assert.equal(m.note, "Delivery #12");
    const audit = await lastAudit("stock.adjust");
    assert.equal(audit.details.quantityAfter, before + 5);
  });

  test("wrong direction, below zero, unknown cells and bad input are refused without changes", async () => {
    const before = await stockOf();
    const post = (body: object) => t.api("/api/admin/inventory/adjust", { cookie: admin, body: { ...CELL, ...body } });
    assert.equal((await post({ change: 3, reason: "damaged" })).status, 409);
    assert.equal((await post({ change: -3, reason: "received" })).status, 409);
    const neg = await post({ change: -(before + 1), reason: "lost" });
    assert.equal(neg.status, 409);
    assert.equal(neg.json.error, "negative_stock");
    assert.equal((await post({ colour: "Nope", change: 1, reason: "correction" })).status, 404);
    assert.equal((await post({ change: 1, reason: "free" })).status, 422);
    assert.equal((await post({ change: 1.5, reason: "correction" })).status, 422);
    assert.equal((await post({ change: 0, reason: "correction" })).status, 422);
    assert.equal(await stockOf(), before);
  });

  test("stock typed on the product form goes into the history, and the save is logged", async () => {
    const product = (await t.api("/api/admin/products/p14", { cookie: admin })).json;
    const size = product.sizes.find((s: { name: string }) => s.name === CELL.size);
    const was = size.stock[CELL.colour];
    size.stock[CELL.colour] = was + 7;
    size.price = size.price + 1;
    const r = await t.api("/api/admin/products/p14", { method: "PUT", cookie: admin, body: product });
    assert.equal(r.status, 200, r.text);
    const m = (await t.db.query("SELECT * FROM stock_movements WHERE product_id = 'p14' AND reason = 'product_edit' ORDER BY id DESC LIMIT 1")).rows[0];
    assert.equal(m.change, 7);
    assert.equal(m.size, CELL.size);
    const audit = await lastAudit("product.update");
    assert.ok(audit.details.changed.includes("sizes"));
    assert.equal(audit.details.prices[0].size, CELL.size);
  });

  test("the low-stock threshold is a setting", async () => {
    await t.db.query("UPDATE product_stock SET quantity = 4 WHERE product_id = 'p14' AND size = $1 AND colour = $2", [CELL.size, CELL.colour]);
    const level = async () => (await t.api("/api/admin/inventory", { cookie: admin })).json.rows.find((r: typeof CELL) => r.productId === CELL.productId && r.size === CELL.size && r.colour === CELL.colour).level;
    assert.equal((await t.api("/api/admin/settings", { method: "PUT", cookie: admin, body: { lowStockThreshold: 3 } })).status, 200);
    assert.equal(await level(), "ok");
    assert.equal((await t.api("/api/admin/settings", { method: "PUT", cookie: admin, body: { lowStockThreshold: 5 } })).json.lowStockThreshold, 5);
    assert.equal(await level(), "low");
    assert.equal((await t.api("/api/admin/settings", { method: "PUT", cookie: admin, body: { lowStockThreshold: -1 } })).status, 422);
    assert.deepEqual((await lastAudit("settings.update")).details, { lowStockThreshold: { from: 3, to: 5 } });
    await t.db.query("UPDATE product_stock SET quantity = 100 WHERE product_id = 'p14'");
    await t.api("/api/admin/settings", { method: "PUT", cookie: admin, body: { lowStockThreshold: 3 } });
  });
});

describe("reviews", () => {
  test("a hidden review leaves the shop and the rating; showing it brings it back", async () => {
    const c = await registerCustomer(t);
    const created = await t.api("/api/products/p14/reviews", { cookie: c.cookie, body: { rating: 1, title: "Spam", body: "Buy followers at example dot test" } });
    assert.equal(created.status, 201, created.text);
    const shop = async () => (await t.api("/api/products")).json.find((p: { id: string }) => p.id === "p14");
    const visible = await shop();
    assert.ok(visible.reviews.some((r: { id: string }) => r.id === created.json.id));

    assert.equal((await t.api(`/api/admin/reviews/${created.json.id}/hide`, { cookie: admin, body: { hidden: true } })).status, 200);
    const hidden = await shop();
    assert.ok(!hidden.reviews.some((r: { id: string }) => r.id === created.json.id));
    assert.equal(hidden.reviewCount, visible.reviewCount - 1);
    const list = await t.api("/api/admin/reviews?status=hidden", { cookie: admin });
    assert.deepEqual(list.json.map((r: { id: string }) => r.id), [created.json.id]);
    assert.equal(list.json[0].email, c.email);
    assert.equal((await lastAudit("review.hide")).entity_id, created.json.id);

    await t.api(`/api/admin/reviews/${created.json.id}/hide`, { cookie: admin, body: { hidden: false } });
    assert.equal((await shop()).reviewCount, visible.reviewCount);

    assert.equal((await t.api(`/api/admin/reviews/${created.json.id}`, { method: "DELETE", cookie: admin })).status, 200);
    assert.equal((await t.db.query("SELECT count(*)::int AS n FROM reviews WHERE id = $1", [created.json.id])).rows[0].n, 0);
    assert.equal((await t.api(`/api/admin/reviews/${created.json.id}`, { method: "DELETE", cookie: admin })).status, 404);
  });
});

describe("dashboard and reports", () => {
  test("dashboard numbers match the database and leave cancelled orders out", async () => {
    const cancelled = await newOrder(3);
    await setStatus(cancelled, "cancelled");
    const d = (await t.api("/api/admin/dashboard?tz=UTC", { cookie: admin })).json;
    const db = (
      await t.db.query(`SELECT count(*)::int AS orders, coalesce(sum(total), 0)::float AS total FROM orders
                         WHERE status <> 'cancelled' AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`)
    ).rows[0];
    assert.equal(d.today.orders, db.orders);
    assert.equal(d.today.total, Math.round(db.total * 100) / 100);
    const statuses = (await t.db.query("SELECT status, count(*)::int AS n FROM orders GROUP BY status")).rows;
    for (const s of statuses) assert.equal(d.ordersByStatus[s.status], s.n);
    assert.equal(d.toPack, d.ordersByStatus.placed ?? 0);
    assert.equal(d.daily.length, 14);
    assert.equal(d.daily.at(-1).orders, db.orders);
  });

  test("the sales report adds up, per product too, and counts cancellations separately", async () => {
    const r = await t.api(`/api/admin/reports/sales?from=${shift(-1)}&to=${shift(1)}&tz=UTC&group=day`, { cookie: admin });
    assert.equal(r.status, 200, r.text);
    const db = (
      await t.db.query(`SELECT count(*) FILTER (WHERE status <> 'cancelled')::int AS orders,
                               coalesce(sum(total) FILTER (WHERE status <> 'cancelled'), 0)::float AS total,
                               coalesce(sum(subtotal - discount) FILTER (WHERE status <> 'cancelled'), 0)::float AS net,
                               count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
                          FROM orders`)
    ).rows[0];
    const s = r.json.summary;
    assert.equal(s.orders, db.orders);
    assert.equal(s.total, Math.round(db.total * 100) / 100);
    assert.equal(s.netSales, Math.round(db.net * 100) / 100);
    assert.equal(s.cancelledOrders, db.cancelled);
    assert.ok(db.cancelled > 0);
    assert.equal(r.json.series.length, 3);
    assert.equal(Math.round(r.json.series.reduce((n: number, p: { total: number }) => n + p.total, 0) * 100) / 100, s.total);
    const units = (await t.db.query("SELECT coalesce(sum(i.quantity), 0)::int AS n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'cancelled' AND i.product_id = 'p14'")).rows[0].n;
    assert.equal(r.json.byProduct.find((p: { productId: string }) => p.productId === "p14").units, units);
    assert.ok(!("profit" in s), "no cost data → no profit figure");
  });

  test("report ranges are validated", async () => {
    for (const q of ["from=2026-02-01&to=2026-01-01", "from=yesterday&to=2026-01-01", "from=2020-01-01&to=2026-01-01", "from=2026-01-01&to=2026-01-02&group=year"]) {
      assert.equal((await t.api(`/api/admin/reports/sales?${q}`, { cookie: admin })).status, 422, q);
    }
  });

  test("CSV export: a file with the orders, logged, and safe to open in a spreadsheet", async () => {
    const r = await t.api(`/api/admin/reports/export?type=orders&from=${today()}&to=${today()}&tz=UTC`, { cookie: admin });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /^text\/csv/);
    assert.match(r.headers.get("content-disposition") ?? "", /attachment; filename="vendora-orders-/);
    const lines = r.text.replace(/^﻿/, "").trim().split("\r\n");
    assert.equal(lines[0], "order,created_at,status,items,subtotal,discount,shipping,tax,total,discount_code,delivery,country");
    const n = (await t.db.query("SELECT count(*)::int AS n FROM orders")).rows[0].n;
    assert.equal(lines.length - 1, n);
    assert.doesNotMatch(r.text, /@example\.test/, "no customer emails in the export");
    assert.equal((await lastAudit("report.export")).entity_id, "orders");
    const products = await t.api(`/api/admin/reports/export?type=products&from=${today()}&to=${today()}&tz=UTC`, { cookie: admin });
    assert.match(products.text, /product_id,sku,product,size,colour,units,item_sales,orders/);
  });

  test("CSV cells can't become spreadsheet formulas", () => {
    assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), `"'=HYPERLINK(""http://evil"")"`);
    assert.equal(csvCell("+1+2"), "'+1+2");
    assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(csvCell("-5"), "-5");
    assert.equal(csvCell("a,b"), '"a,b"');
  });
});

describe("activity log", () => {
  test("the admin can read it; the app's database role can't change or delete entries", async () => {
    const list = await t.api("/api/admin/activity", { cookie: admin });
    assert.equal(list.status, 200);
    assert.ok(list.json.some((e: { action: string }) => e.action === "admin.login"));
    // t.db connects as the app role (vendora_app)
    await assert.rejects(t.db.query("UPDATE admin_audit_log SET actor = 'someone else'"), /permission denied/);
    await assert.rejects(t.db.query("DELETE FROM admin_audit_log"), /permission denied/);
  });

  test("customer actions are logged without personal details", async () => {
    const c = await registerCustomer(t);
    await t.api(`/api/admin/customers/${c.id}/block`, { cookie: admin, body: { blocked: true } });
    const entry = await lastAudit("customer.block");
    assert.equal(entry.entity_id, c.id);
    assert.doesNotMatch(JSON.stringify(entry.details), /@/);
  });
});
