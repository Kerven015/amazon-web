/**
 * "What's new" badges on the admin Manage menu, and "Clear history" in each admin section.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, orderBody, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
let admin: string;
before(async () => {
  t = await startServer();
  await t.db.query("UPDATE product_stock SET quantity = 100");
  admin = await adminLogin(t);
});
after(async () => t?.close());

const CELL = { productId: "p14", size: "Face cloth", colour: "Chalk" };
const notifications = async () => (await t.api("/api/admin/notifications", { cookie: admin })).json;
const seen = (section: string) => t.api("/api/admin/notifications/seen", { cookie: admin, body: { section } });
const count = async (sql: string) => (await t.db.query(sql)).rows[0].n as number;
async function newOrder(quantity = 1) {
  const c = await registerCustomer(t);
  const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ items: [{ ...CELL, quantity }] }) });
  assert.equal(r.status, 201, r.text);
  return { id: r.json.id as string, customer: c };
}
const setStatus = (id: string, status: string) => t.api(`/api/admin/orders/${id}/status`, { method: "PATCH", cookie: admin, body: { status } });
const clear = (what: string, body: object = { confirm: true }) => t.api(`/api/admin/history/${what}/clear`, { cookie: admin, body });

describe("access", () => {
  test("notifications and clearing need an admin session", async () => {
    const c = await registerCustomer(t);
    for (const [method, path] of [
      ["GET", "/api/admin/notifications"],
      ["POST", "/api/admin/notifications/seen"],
      ["GET", "/api/admin/history/orders"],
      ["POST", "/api/admin/history/orders/clear"],
      ["POST", "/api/admin/history/activity/clear"],
    ]) {
      for (const cookie of [undefined, c.cookie]) assert.equal((await t.api(path, { method, cookie, body: method === "GET" ? undefined : { confirm: true } })).status, 401, path);
    }
  });

  test("clearing from another site, or without confirm: true, deletes nothing", async () => {
    const { id } = await newOrder();
    await setStatus(id, "cancelled");
    assert.equal((await t.api("/api/admin/history/orders/clear", { cookie: admin, body: { confirm: true }, headers: { Origin: "https://evil.example" } })).status, 403);
    assert.equal((await clear("orders", {})).status, 422);
    assert.equal((await clear("orders", { confirm: "yes" })).status, 422);
    assert.equal((await clear("everything")).status, 404);
    assert.equal(await count(`SELECT count(*)::int AS n FROM orders WHERE id = '${id}'`), 1);
  });
});

describe("notifications", () => {
  test("new orders, customers and reviews are counted until the section is opened", async () => {
    const start = await notifications();
    const { customer } = await newOrder();
    await t.api("/api/products/p14/reviews", { cookie: customer.cookie, body: { rating: 4, title: "Nice", body: "Soft and absorbent towel." } });
    const now = await notifications();
    assert.equal(now.orders, start.orders + 1);
    assert.equal(now.customers, start.customers + 1);
    assert.equal(now.reviews, start.reviews + 1);
    const after = (await seen("orders")).json;
    assert.equal(after.orders, 0);
    assert.equal(after.customers, now.customers, "other sections keep their count");
    assert.equal((await seen("nope")).status, 422);
  });

  test("a size/colour that sells down to the low-stock level is flagged", async () => {
    await seen("inventory");
    await t.db.query("UPDATE product_stock SET quantity = 4 WHERE product_id = $1 AND size = $2 AND colour = $3", [CELL.productId, CELL.size, CELL.colour]);
    await newOrder(2); // 4 → 2, at or below the default threshold of 3
    assert.equal((await notifications()).inventory, 1);
    await seen("inventory");
    assert.equal((await notifications()).inventory, 0);
    await t.db.query("UPDATE product_stock SET quantity = 100");
  });
});

describe("clear history", () => {
  test("orders: only delivered and cancelled orders are deleted (with their lines and events)", async () => {
    const done = await newOrder();
    await setStatus(done.id, "delivered");
    const cancelled = await newOrder();
    await setStatus(cancelled.id, "cancelled");
    const open = await newOrder();
    const preview = (await t.api("/api/admin/history/orders", { cookie: admin })).json.count;
    const finished = await count("SELECT count(*)::int AS n FROM orders WHERE status IN ('delivered', 'cancelled')");
    assert.equal(preview, finished);
    const r = await clear("orders");
    assert.equal(r.json.removed, finished);
    assert.equal(await count("SELECT count(*)::int AS n FROM orders WHERE status IN ('delivered', 'cancelled')"), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM order_items WHERE order_id IN ('${done.id}', '${cancelled.id}')`), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM order_events WHERE order_id = '${done.id}'`), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM orders WHERE id = '${open.id}'`), 1, "open orders stay");
    const entry = (await t.db.query("SELECT * FROM admin_audit_log WHERE action = 'history.clear' ORDER BY id DESC LIMIT 1")).rows[0];
    assert.equal(entry.entity_id, "orders");
    assert.equal(entry.details.removed, finished);
  });

  test("inventory: the stock history is deleted, stock levels are not", async () => {
    const stock = await count("SELECT sum(quantity)::int AS n FROM product_stock");
    assert.ok(await count("SELECT count(*)::int AS n FROM stock_movements") > 0);
    await clear("inventory");
    assert.equal(await count("SELECT count(*)::int AS n FROM stock_movements"), 0);
    assert.equal(await count("SELECT sum(quantity)::int AS n FROM product_stock"), stock);
  });

  test("reviews: hidden reviews are deleted, shown ones stay", async () => {
    const c = await registerCustomer(t);
    const keep = await t.api("/api/products/p14/reviews", { cookie: c.cookie, body: { rating: 5, title: "Keep", body: "A review that stays visible." } });
    const c2 = await registerCustomer(t);
    const hide = await t.api("/api/products/p14/reviews", { cookie: c2.cookie, body: { rating: 1, title: "Hide", body: "A review the admin hides." } });
    await t.api(`/api/admin/reviews/${hide.json.id}/hide`, { cookie: admin, body: { hidden: true } });
    await clear("reviews");
    assert.equal(await count(`SELECT count(*)::int AS n FROM reviews WHERE id = '${hide.json.id}'`), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM reviews WHERE id = '${keep.json.id}'`), 1);
    assert.equal(await count("SELECT count(*)::int AS n FROM reviews WHERE hidden_at IS NOT NULL"), 0);
  });

  test("customers: expired sessions and old failed sign-ins go; accounts and live sessions stay", async () => {
    const live = await registerCustomer(t);
    const old = await registerCustomer(t);
    await t.db.query("UPDATE sessions SET expires_at = now() - interval '1 hour' WHERE user_id = $1", [old.id]);
    await t.db.query("INSERT INTO login_attempts (ip, email, at) VALUES ('203.0.113.9', 'x@example.test', now() - interval '2 days'), ('203.0.113.9', 'y@example.test', now())");
    await clear("customers");
    assert.equal(await count(`SELECT count(*)::int AS n FROM sessions WHERE user_id = '${old.id}'`), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM sessions WHERE user_id = '${live.id}'`), 1);
    assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE id = '${old.id}'`), 1, "the account stays");
    assert.equal(await count("SELECT count(*)::int AS n FROM login_attempts WHERE email = 'x@example.test'"), 0);
    assert.equal(await count("SELECT count(*)::int AS n FROM login_attempts WHERE email = 'y@example.test'"), 1, "recent attempts still count for the rate limit");
    assert.equal((await t.api("/api/auth/me", { cookie: live.cookie })).status, 200);
  });

  test("activity log: everything is deleted except one entry saying who cleared it", async () => {
    const before = await count("SELECT count(*)::int AS n FROM admin_audit_log");
    assert.ok(before > 1);
    const r = await clear("activity");
    assert.equal(r.json.removed, before);
    const rows = (await t.db.query("SELECT * FROM admin_audit_log")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, "activity.clear");
    assert.equal(rows[0].actor, "admin");
    assert.equal(rows[0].details.removed, before);
    // The app role still can't delete or edit entries directly
    await assert.rejects(t.db.query("DELETE FROM admin_audit_log"), /permission denied/);
    await assert.rejects(t.db.query("UPDATE admin_audit_log SET actor = 'x'"), /permission denied/);
  });

  test("nothing to clear → 0 removed", async () => {
    await clear("inventory");
    assert.equal((await t.api("/api/admin/history/inventory", { cookie: admin })).json.count, 0);
    assert.equal((await clear("inventory")).json.removed, 0);
  });
});
