/**
 * Server-side validation: the server decides prices and totals, ignores extra fields,
 * rejects malformed or oversized input, and never leaks internal errors.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, orderBody, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
before(async () => (t = await startServer()));
after(async () => t?.close());

describe("orders: the server works out every price", () => {
  test("prices, totals and user ids sent by the browser are ignored", async () => {
    const c = await registerCustomer(t);
    const other = await registerCustomer(t);
    const body = {
      ...orderBody(),
      items: [{ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: 2, price: 0.01, unitPrice: 0.01 }],
      subtotal: 0.01,
      total: 0.01,
      discount: 999,
      userId: other.id,
      status: "delivered",
    };
    const r = await t.api("/api/orders", { cookie: c.cookie, body });
    assert.equal(r.status, 201, r.text);
    const { rows } = await t.db.query("SELECT (data->'sizes'->0->>'salePrice')::numeric AS sale FROM products WHERE id = 'p14'");
    assert.equal(r.json.items[0].price, Number(rows[0].sale), "unit price comes from the database");
    assert.equal(r.json.subtotal, Number(rows[0].sale) * 2);
    assert.ok(r.json.total > 1);
    assert.equal(r.json.status, "placed");
    // It belongs to the signed-in customer, not the user id in the body
    assert.equal((await t.api(`/api/orders/${r.json.id}`, { cookie: other.cookie })).status, 404);
  });

  test("a made-up discount code is refused instead of silently applied", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ discountCode: "FREE100" }) });
    assert.equal(r.status, 422);
    assert.equal(r.json.error, "invalid_discount");
  });

  test("ordering more than is in stock fails and saves nothing", async () => {
    const c = await registerCustomer(t);
    const before = await t.db.query("SELECT quantity FROM product_stock WHERE product_id = 'p14' AND size = 'Face cloth' AND colour = 'Clay'");
    const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ items: [{ productId: "p14", size: "Face cloth", colour: "Clay", quantity: before.rows[0].quantity + 1 }] }) });
    assert.equal(r.status, 409);
    assert.equal(r.json.error, "out_of_stock");
    const after = await t.db.query("SELECT quantity FROM product_stock WHERE product_id = 'p14' AND size = 'Face cloth' AND colour = 'Clay'");
    assert.equal(after.rows[0].quantity, before.rows[0].quantity);
    assert.equal((await t.db.query("SELECT count(*)::int AS n FROM orders WHERE email = $1", [c.email])).rows[0].n, 0);
  });

  test("unknown products, sizes and colours are refused", async () => {
    const c = await registerCustomer(t);
    for (const item of [
      { productId: "does-not-exist", size: "Face cloth", colour: "Chalk", quantity: 1 },
      { productId: "p14", size: "Giant", colour: "Chalk", quantity: 1 },
      { productId: "p14", size: "Face cloth", colour: "Neon", quantity: 1 },
    ]) {
      const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ items: [item] }) });
      assert.equal(r.status, 409, JSON.stringify(item));
    }
  });

  for (const [label, items] of [
    ["negative quantity", [{ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: -5 }]],
    ["zero quantity", [{ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: 0 }]],
    ["fractional quantity", [{ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: 1.5 }]],
    ["quantity as text", [{ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: "1" }]],
    ["empty order", []],
  ] as const) {
    test(`${label} → 422 validation`, async () => {
      const c = await registerCustomer(t);
      const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ items }) });
      assert.equal(r.status, 422);
      assert.equal(r.json.error, "validation");
    });
  }

  test("a shipping country we don't deliver to is refused", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/orders", { cookie: c.cookie, body: orderBody({ address: { ...orderBody().address, country: "XX" } }) });
    assert.equal(r.status, 422);
  });
});

describe("accounts: no mass assignment", () => {
  test("profile updates can't set ids, roles, blocked state or verification", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/account/profile", {
      method: "PATCH",
      cookie: c.cookie,
      body: { name: "New Name", id: "00000000-0000-0000-0000-000000000000", role: "admin", isAdmin: true, blocked_at: null, email_verified_at: "2020-01-01", password_hash: "x" },
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.id, c.id);
    const { rows } = await t.db.query("SELECT name, email_verified_at, password_hash FROM users WHERE id = $1", [c.id]);
    assert.equal(rows[0].name, "New Name");
    assert.equal(rows[0].email_verified_at, null);
    assert.match(rows[0].password_hash, /^\$argon2id\$/);
  });

  test("registration ignores extra fields like isAdmin", async () => {
    const r = await t.api("/api/auth/register", { body: { name: "Eve", email: "eve-extra@example.test", password: "long-enough-1", isAdmin: true, role: "admin", email_verified_at: "2020-01-01" } });
    assert.equal(r.status, 201);
    const { rows } = await t.db.query("SELECT email_verified_at FROM users WHERE email = 'eve-extra@example.test'");
    assert.equal(rows[0].email_verified_at, null);
    // …and the customer session doesn't reach the admin
    assert.equal((await t.api("/api/admin/session", { cookie: r.cookie! })).status, 401);
  });

  test("passwords shorter than 8 characters are refused by the server (not just the form)", async () => {
    const r = await t.api("/api/auth/register", { body: { name: "Short", email: "short@example.test", password: "1234567" } });
    assert.equal(r.status, 422);
    assert.ok(r.json.fields.password);
  });
});

describe("malformed and oversized requests", () => {
  test("invalid JSON → 400, not 500", async () => {
    const r = await t.api("/api/auth/login", { method: "POST", raw: "{not json", headers: { "Content-Type": "application/json" } });
    assert.equal(r.status, 400);
  });

  test("a body over the limit → 413", async () => {
    const r = await t.api("/api/auth/login", { method: "POST", raw: JSON.stringify({ email: "a@b.c", password: "x".repeat(20_000) }), headers: { "Content-Type": "application/json" } });
    assert.equal(r.status, 413);
  });

  test("wrong types in a body → 422 with field names, never a server error", async () => {
    const r = await t.api("/api/auth/login", { body: { email: ["a@b.c"], password: { $ne: null } } });
    assert.equal(r.status, 422);
  });

  test("an upload that isn't really an image is refused", async () => {
    const admin = await adminLogin(t);
    const r = await t.api("/api/admin/upload?slug=test&name=evil.png", {
      method: "POST",
      cookie: admin,
      raw: Buffer.from("<?php system($_GET['c']); ?>"),
      headers: { "Content-Type": "image/png" },
    });
    assert.equal(r.status, 415);
  });

  test("upload names can't escape the uploads folder", async () => {
    const admin = await adminLogin(t);
    // A real 1×1 PNG
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const r = await t.api("/api/admin/upload?slug=../../etc&name=../../passwd.png", { method: "POST", cookie: admin, raw: png, headers: { "Content-Type": "image/png" } });
    assert.equal(r.status, 201, r.text);
    assert.match(r.json.src, /^\/images\/products\/etc\/passwd-[0-9a-f]{6}\.webp$/);
  });

  test("server errors don't reveal internals", async () => {
    const r = await t.api("/api/products/p14/reviews", { method: "POST", body: {} });
    assert.ok(!/stack|at \w+ \(|SELECT|postgres/i.test(r.text));
  });
});
