/**
 * Abuse limits (F-02): orders cost nothing yet but take stock, reviews can be spammed,
 * and address books can be filled by scripts.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, newIp, orderBody, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
before(async () => {
  t = await startServer();
  // These tests place dozens of orders: make sure stock isn't what stops them
  await t.db.query("UPDATE product_stock SET quantity = 1000");
});
after(async () => t?.close());

describe("orders", () => {
  test("at most 3 orders waiting to be processed per customer", async () => {
    const c = await registerCustomer(t);
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await t.api("/api/orders", { cookie: c.cookie, body: orderBody() })).status);
    assert.deepEqual(codes, [201, 201, 201, 429]);
    const last = await t.api("/api/orders", { cookie: c.cookie, body: orderBody() });
    assert.equal(last.json.error, "too_many_orders");
  });

  test("once the shop packs an order, the customer can order again", async () => {
    const c = await registerCustomer(t);
    const admin = await adminLogin(t);
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await t.api("/api/orders", { cookie: c.cookie, body: orderBody() })).json.id);
    assert.equal((await t.api("/api/orders", { cookie: c.cookie, body: orderBody() })).status, 429);
    await t.api(`/api/admin/orders/${ids[0]}/status`, { method: "PATCH", cookie: admin, body: { status: "packed" } });
    assert.equal((await t.api("/api/orders", { cookie: c.cookie, body: orderBody() })).status, 201);
  });

  test("simultaneous checkouts can't slip past the limit", async () => {
    const c = await registerCustomer(t);
    const results = await Promise.all(Array.from({ length: 8 }, () => t.api("/api/orders", { cookie: c.cookie, body: orderBody() })));
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.equal((await t.db.query("SELECT count(*)::int AS n FROM orders WHERE email = $1", [c.email])).rows[0].n, 3);
  });

  test("more than 10 of one item, or 50 items, in one order is refused", async () => {
    const c = await registerCustomer(t);
    const split = { items: Array.from({ length: 3 }, () => ({ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: 4 })) };
    const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody(split) });
    assert.equal(r.status, 422);
    assert.equal(r.json.error, "order_too_large");
  });

  test("many accounts from one address are limited too", async () => {
    const ip = newIp();
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) {
      const c = await registerCustomer(t);
      codes.push((await t.api("/api/orders", { ip, cookie: c.cookie, body: orderBody() })).status);
    }
    assert.equal(codes.filter((s) => s === 201).length, 20);
    assert.equal(codes.at(-1), 429);
  });
});

describe("reviews", () => {
  test("one review per product, and at most 5 an hour per account", async () => {
    const c = await registerCustomer(t);
    const review = { rating: 5, title: "Great", body: "Lovely and soft towel." };
    assert.equal((await t.api("/api/products/p14/reviews", { cookie: c.cookie, body: review })).status, 201);
    assert.equal((await t.api("/api/products/p14/reviews", { cookie: c.cookie, body: review })).status, 409);
    const { rows } = await t.db.query("SELECT id FROM products WHERE deleted_at IS NULL AND NOT hidden AND id <> 'p14' ORDER BY position LIMIT 5");
    const codes = [];
    for (const p of rows) codes.push((await t.api(`/api/products/${p.id}/reviews`, { cookie: c.cookie, body: review })).status);
    // 2 of the 5 per hour were used above (the duplicate counts as a try)
    assert.deepEqual(codes, [201, 201, 201, 429, 429]);
  });
});

describe("addresses", () => {
  test("at most 20 saved addresses per customer", async () => {
    const c = await registerCustomer(t);
    const codes = [];
    for (let i = 0; i < 21; i++) {
      codes.push((await t.api("/api/account/addresses", { cookie: c.cookie, body: { ...orderBody().address, line1: `${i} Test St` } })).status);
    }
    assert.equal(codes.filter((s) => s === 201).length, 20);
    const last = await t.api("/api/account/addresses", { cookie: c.cookie, body: { ...orderBody().address, line1: "Over the limit" } });
    assert.equal(last.status, 422);
    assert.equal(last.json.error, "too_many_addresses");
  });
});
