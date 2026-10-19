/**
 * Injection: SQL-looking input is treated as plain data, and HTML/script in user text is
 * stored and returned as text (React escapes it when it's shown).
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
before(async () => (t = await startServer()));
after(async () => t?.close());

const SQL = ["' OR '1'='1", "'; DROP TABLE users; --", "admin'--", "\" OR \"\"=\"", "1; SELECT pg_sleep(5)", "%' OR 1=1 --", "\\'"];

describe("SQL injection", () => {
  test("SQL in the login form neither signs in nor errors", async () => {
    await registerCustomer(t);
    for (const s of SQL) {
      for (const body of [
        { email: `${s}@example.test`, password: "x" },
        { email: "anyone@example.test", password: s },
      ]) {
        const r = await t.api("/api/auth/login", { body });
        assert.ok([401, 422].includes(r.status), `${r.status} for ${JSON.stringify(body)}`);
        assert.equal(r.cookie, null);
      }
    }
  });

  test("SQL in the admin customer search matches literally", async () => {
    const admin = await adminLogin(t);
    await registerCustomer(t);
    for (const s of SQL) {
      const started = Date.now();
      const r = await t.api(`/api/admin/customers?q=${encodeURIComponent(s)}`, { cookie: admin });
      assert.equal(r.status, 200, s);
      assert.equal(r.json.length, 0, `"${s}" must not match every customer`);
      assert.ok(Date.now() - started < 3000, "no pg_sleep");
    }
    // The tables are all still there
    assert.equal((await t.db.query("SELECT count(*)::int AS n FROM users")).rows[0].n > 0, true);
  });

  test("SQL in names and addresses is stored as text", async () => {
    const c = await registerCustomer(t);
    const name = "Robert'); DROP TABLE orders;--";
    const r = await t.api("/api/account/profile", { method: "PATCH", cookie: c.cookie, body: { name } });
    assert.equal(r.status, 200);
    assert.equal(r.json.name, name);
    assert.equal((await t.db.query("SELECT to_regclass('public.orders') IS NOT NULL AS ok")).rows[0].ok, true);
  });

  test("ids in URLs that aren't ids are not found, not errors", async () => {
    const c = await registerCustomer(t);
    const admin = await adminLogin(t);
    for (const [path, cookie] of [
      ["/api/orders/VD-123456' OR '1'='1", c.cookie],
      ["/api/account/addresses/1 OR 1=1", c.cookie],
      ["/api/admin/products/p14' OR '1'='1", admin],
    ]) {
      const r = await t.api(encodeURI(path), { cookie });
      assert.ok([404, 401].includes(r.status), `${path} → ${r.status}`);
    }
  });
});

describe("stored XSS", () => {
  const PAYLOADS = ["<script>alert(1)</script>", '<img src=x onerror="alert(1)">', "javascript:alert(1)", "</script><svg onload=alert(1)>"];

  test("script in a review is kept as plain text and served as JSON", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/products/p14/reviews", { cookie: c.cookie, body: { rating: 5, title: PAYLOADS[0], body: `${PAYLOADS[1]} really soft towel`, author: PAYLOADS[3] } });
    assert.equal(r.status, 201, r.text);
    const products = await t.api("/api/products");
    assert.match(products.headers.get("content-type") ?? "", /^application\/json/);
    const review = products.json.find((p: { id: string }) => p.id === "p14").reviews.find((x: { id: string }) => x.id === r.json.id);
    // Returned exactly as typed (escaping happens when React renders it), never turned into markup
    assert.equal(review.title, PAYLOADS[0]);
    assert.equal(review.author, PAYLOADS[3]);
  });

  test("script in a customer name stays text in the admin API", async () => {
    const c = await registerCustomer(t, PAYLOADS[1]);
    const admin = await adminLogin(t);
    const r = await t.api(`/api/admin/customers/${c.id}`, { cookie: admin });
    assert.equal(r.json.name, PAYLOADS[1]);
    assert.match(r.headers.get("content-type") ?? "", /^application\/json/);
  });

  test("product images can't be javascript: or data: URLs", async () => {
    const admin = await adminLogin(t);
    const product = (await t.api("/api/admin/products/p14", { cookie: admin })).json;
    for (const src of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      const r = await t.api("/api/admin/products/p14", { method: "PUT", cookie: admin, body: { ...product, images: [{ src, alt: "x" }] } });
      assert.equal(r.status, 422, src);
    }
  });
});
