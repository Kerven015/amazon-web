/**
 * Cross-site requests and production security headers.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, orderBody, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
before(async () => (t = await startServer()));
after(async () => t?.close());

describe("CSRF: state-changing requests from other sites are refused", () => {
  test("customer actions with a foreign Origin → 403", async () => {
    const c = await registerCustomer(t);
    for (const [method, path, body] of [
      ["POST", "/api/orders", orderBody()],
      ["PATCH", "/api/account/profile", { name: "Hacked" }],
      ["POST", "/api/auth/logout-all", {}],
      ["PUT", "/api/account/cart", { items: [] }],
    ] as const) {
      const r = await t.api(path, { method, cookie: c.cookie, body, headers: { Origin: "https://evil.example" } });
      assert.equal(r.status, 403, `${method} ${path}`);
    }
    const { rows } = await t.db.query("SELECT name FROM users WHERE id = $1", [c.id]);
    assert.equal(rows[0].name, "Test Customer");
  });

  test("admin actions with a foreign Origin → 403", async () => {
    const admin = await adminLogin(t);
    const r = await t.api("/api/admin/products/delete", { cookie: admin, body: { ids: ["p14"] }, headers: { Origin: "https://evil.example" } });
    assert.equal(r.status, 403);
    assert.equal((await t.db.query("SELECT deleted_at FROM products WHERE id = 'p14'")).rows[0].deleted_at, null);
  });

  test("Sec-Fetch-Site: cross-site is refused even without an Origin header", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/account/profile", { method: "PATCH", cookie: c.cookie, body: { name: "Hacked" }, headers: { "Sec-Fetch-Site": "cross-site" } });
    assert.equal(r.status, 403);
  });

  test("the same origin is allowed", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/account/profile", { method: "PATCH", cookie: c.cookie, body: { name: "Fine" }, headers: { Origin: t.base } });
    assert.equal(r.status, 200);
  });
});

describe("CORS", () => {
  test("other origins get no CORS permission (so their pages can't read our API with cookies)", async () => {
    const r = await t.api("/api/auth/me", { headers: { Origin: "https://evil.example" } });
    assert.equal(r.headers.get("access-control-allow-origin"), null);
    assert.equal(r.headers.get("access-control-allow-credentials"), null);
  });

  test("a CORS preflight from another origin isn't granted", async () => {
    const r = await t.api("/api/orders", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  });
});

describe("security headers (production)", () => {
  test("CSP, HSTS, framing and sniffing protections are present", async () => {
    const r = await t.api("/api/products");
    const csp = r.headers.get("content-security-policy") ?? "";
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.match(r.headers.get("strict-transport-security") ?? "", /max-age=\d{7,}/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-powered-by"), null);
  });

  test("API responses aren't cached and are JSON", async () => {
    const c = await registerCustomer(t);
    const r = await t.api("/api/auth/me", { cookie: c.cookie });
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.match(r.headers.get("content-type") ?? "", /^application\/json/);
  });
});
