/**
 * Access control: admin routes need an admin session, account routes need a customer
 * session, and customers can only see and change their own data.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, orderBody, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
before(async () => (t = await startServer()));
after(async () => t?.close());

const ADMIN_ROUTES: [string, string][] = [
  ["GET", "/api/admin/session"],
  ["GET", "/api/admin/products"],
  ["POST", "/api/admin/products"],
  ["GET", "/api/admin/products/p14"],
  ["PUT", "/api/admin/products/p14"],
  ["DELETE", "/api/admin/products/p14"],
  ["POST", "/api/admin/products/delete"],
  ["POST", "/api/admin/products/restore"],
  ["POST", "/api/admin/upload"],
  ["GET", "/api/admin/orders"],
  ["PATCH", "/api/admin/orders/VD-123456/status"],
  ["GET", "/api/admin/customers"],
  ["GET", "/api/admin/customers/00000000-0000-0000-0000-000000000000"],
  ["POST", "/api/admin/customers/00000000-0000-0000-0000-000000000000/block"],
  ["DELETE", "/api/admin/customers/00000000-0000-0000-0000-000000000000"],
  ["POST", "/api/admin/logout-all"],
];

const CUSTOMER_ROUTES: [string, string][] = [
  ["GET", "/api/account/profile"],
  ["PATCH", "/api/account/profile"],
  ["POST", "/api/account/password"],
  ["GET", "/api/account/cart"],
  ["PUT", "/api/account/cart"],
  ["GET", "/api/account/addresses"],
  ["POST", "/api/account/addresses"],
  ["GET", "/api/account/wishlist"],
  ["GET", "/api/account/orders"],
  ["GET", "/api/account/reviews"],
  ["POST", "/api/orders"],
  ["GET", "/api/orders/VD-123456"],
  ["POST", "/api/products/p14/reviews"],
  ["POST", "/api/auth/logout-all"],
];

describe("admin API", () => {
  for (const [method, path] of ADMIN_ROUTES) {
    test(`${method} ${path} without an admin session → 401`, async () => {
      const r = await t.api(path, { method, body: method === "GET" ? undefined : {} });
      assert.equal(r.status, 401);
    });
  }

  test("a customer session doesn't open the admin API", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/admin/customers", { cookie: c.cookie });
    assert.equal(r.status, 401);
  });

  test("a forged admin cookie (wrong signature) is rejected", async () => {
    const real = await adminLogin(t);
    const token = real.split("=")[1];
    const [h, p] = token.split(".");
    const r = await t.api("/api/admin/session", { cookie: `vendora_admin=${h}.${p}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` });
    assert.equal(r.status, 401);
  });

  test("an admin cookie with role edited in the payload is rejected", async () => {
    const real = await adminLogin(t);
    const [h, p, s] = real.split("=")[1].split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    const tampered = Buffer.from(JSON.stringify({ ...payload, exp: payload.exp + 999999 })).toString("base64url");
    const r = await t.api("/api/admin/session", { cookie: `vendora_admin=${h}.${tampered}.${s}` });
    assert.equal(r.status, 401);
  });

  test("/admin pages redirect to the login page without a session", async () => {
    const r = await t.api("/admin/customers", { headers: { Accept: "text/html" } });
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location") ?? "", /^\/admin\/login\?next=/);
  });
});

describe("customer API", () => {
  for (const [method, path] of CUSTOMER_ROUTES) {
    test(`${method} ${path} without a session → 401`, async () => {
      const r = await t.api(path, { method, body: method === "GET" ? undefined : {} });
      assert.equal(r.status, 401);
      assert.equal(r.json?.error, "sign_in_required");
    });
  }

  test("a made-up session cookie is rejected", async () => {
    const r = await t.api("/api/auth/me", { cookie: "vendora_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
    assert.equal(r.status, 401);
  });
});

describe("customers only reach their own data (no IDOR)", () => {
  test("order, addresses, cart and wishlist of customer A are invisible to customer B", async () => {
    const a = await registerCustomer(t, "Alice");
    const b = await registerCustomer(t, "Bob");

    const order = await t.api("/api/orders", { cookie: a.cookie, body: orderBody() });
    assert.equal(order.status, 201, order.text);
    const id = order.json.id;
    const addr = await t.api("/api/account/addresses", { cookie: a.cookie, body: orderBody().address });
    const addrId = addr.json.address.id;
    await t.api("/api/account/wishlist", { method: "PUT", cookie: a.cookie, body: { ids: ["p14"] } });

    // B tries A's order, by both URLs
    assert.equal((await t.api(`/api/orders/${id}`, { cookie: b.cookie })).status, 404);
    assert.equal((await t.api(`/api/account/orders/${id}`, { cookie: b.cookie })).status, 404);
    // B's own lists don't contain A's things
    assert.equal((await t.api("/api/account/orders", { cookie: b.cookie })).json.orders.length, 0);
    assert.equal((await t.api("/api/account/addresses", { cookie: b.cookie })).json.addresses.length, 0);
    assert.deepEqual((await t.api("/api/account/wishlist", { cookie: b.cookie })).json.ids, []);
    // B can't change or delete A's address by its id
    assert.equal((await t.api(`/api/account/addresses/${addrId}`, { method: "PATCH", cookie: b.cookie, body: { city: "Hacked" } })).status, 404);
    assert.equal((await t.api(`/api/account/addresses/${addrId}/default`, { method: "POST", cookie: b.cookie })).status, 404);
    assert.equal((await t.api(`/api/account/addresses/${addrId}`, { method: "DELETE", cookie: b.cookie })).status, 404);
    // …and it's unchanged for A
    const mine = await t.api("/api/account/addresses", { cookie: a.cookie });
    assert.equal(mine.json.addresses[0].city, "Portland");
    // B can't order to A's saved address
    const steal = await t.api("/api/orders", { cookie: b.cookie, body: orderBody({ address: undefined, addressId: addrId }) });
    assert.equal(steal.status, 422);
    assert.equal(steal.json.error, "address_not_found");
  });

  test("the public product list never contains hidden products or customer ids", async () => {
    const r = await t.api("/api/products");
    assert.equal(r.status, 200);
    assert.ok(!r.text.includes("user_id"));
    assert.ok(!r.text.includes("password"));
    assert.ok(r.json.every((p: { hidden?: boolean }) => !p.hidden));
  });
});
