/**
 * Authentication and sessions: password storage, rate limits, cookie flags, and that
 * logging out / blocking / changing passwords really ends sessions.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN, adminLogin, newIp, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
before(async () => (t = await startServer()));
after(async () => t?.close());

describe("passwords", () => {
  test("customer passwords are stored as Argon2id hashes, never in plain text", async () => {
    const c = await registerCustomer(t);
    const { rows } = await t.db.query("SELECT password_hash FROM users WHERE id = $1", [c.id]);
    assert.match(rows[0].password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.ok(!rows[0].password_hash.includes("customer-pass-123"));
  });

  test("no API response ever contains a password hash", async () => {
    const c = await registerCustomer(t);
    const admin = await adminLogin(t);
    for (const r of [
      await t.api("/api/auth/me", { cookie: c.cookie }),
      await t.api("/api/account/profile", { cookie: c.cookie }),
      await t.api("/api/admin/customers", { cookie: admin }),
      await t.api(`/api/admin/customers/${c.id}`, { cookie: admin }),
    ]) {
      assert.equal(r.status, 200);
      assert.ok(!/argon2|password_hash/i.test(r.text), r.text.slice(0, 200));
    }
  });

  test("wrong password and unknown email give the same answer", async () => {
    const c = await registerCustomer(t);
    const wrong = await t.api("/api/auth/login", { body: { email: c.email, password: "not-the-password" } });
    const unknown = await t.api("/api/auth/login", { body: { email: "nobody-here@example.test", password: "not-the-password" } });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.json, unknown.json);
  });
});

describe("rate limits", () => {
  test("customer sign-in: the 6th quick failure for one email is blocked", async () => {
    const c = await registerCustomer(t);
    const ip = newIp();
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await t.api("/api/auth/login", { ip, body: { email: c.email, password: "wrong-password" } })).status);
    assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
    // Even the right password is refused while blocked…
    assert.equal((await t.api("/api/auth/login", { ip, body: { email: c.email, password: "customer-pass-123" } })).status, 429);
    // …but only for that visitor: someone else can still sign in
    assert.equal((await t.api("/api/auth/login", { body: { email: c.email, password: "customer-pass-123" } })).status, 200);
  });

  test("admin sign-in: an address is locked after 5 failures", async () => {
    const ip = newIp();
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await t.api("/api/admin/login", { ip, body: { username: "admin", password: "guess" } })).status);
    assert.deepEqual(codes, [401, 401, 401, 401, 429, 429]);
  });
});

describe("customer sessions", () => {
  test("session cookie is HttpOnly, Secure and SameSite=Lax; only a hash is stored", async () => {
    const r = await t.api("/api/auth/register", { body: { name: "Cookie", email: "cookie@example.test", password: "long-enough-1" } });
    const set = r.headers.getSetCookie().join("\n");
    assert.match(set, /vendora_session=[^;]+;.*HttpOnly/);
    assert.match(set, /Secure/);
    assert.match(set, /SameSite=Lax/);
    const token = r.cookie!.split("=")[1];
    const { rows } = await t.db.query("SELECT id FROM sessions");
    assert.ok(rows.every((row: { id: string }) => row.id !== token && /^[0-9a-f]{64}$/.test(row.id)));
  });

  test("logging out ends the session on the server (a copied cookie stops working)", async () => {
    const c = await registerCustomer(t);
    assert.equal((await t.api("/api/auth/me", { cookie: c.cookie })).status, 200);
    await t.api("/api/auth/logout", { method: "POST", cookie: c.cookie });
    assert.equal((await t.api("/api/auth/me", { cookie: c.cookie })).status, 401);
  });

  test("changing the password signs out other devices, not this one", async () => {
    const c = await registerCustomer(t);
    const other = (await t.api("/api/auth/login", { body: { email: c.email, password: "customer-pass-123" } })).cookie!;
    const r = await t.api("/api/account/password", { cookie: c.cookie, body: { currentPassword: "customer-pass-123", newPassword: "brand-new-pass-1" } });
    assert.equal(r.status, 200);
    assert.equal((await t.api("/api/auth/me", { cookie: c.cookie })).status, 200);
    assert.equal((await t.api("/api/auth/me", { cookie: other })).status, 401);
  });

  test("changing password or email needs the current password", async () => {
    const c = await registerCustomer(t);
    assert.equal((await t.api("/api/account/password", { cookie: c.cookie, body: { currentPassword: "wrong", newPassword: "brand-new-pass-1" } })).status, 403);
    assert.equal((await t.api("/api/account/password", { cookie: c.cookie, body: { newPassword: "brand-new-pass-1" } })).status, 403);
    assert.equal((await t.api("/api/account/profile", { method: "PATCH", cookie: c.cookie, body: { email: "taken-over@example.test" } })).status, 403);
  });

  test("blocking a customer ends their sessions and stops sign-in", async () => {
    const c = await registerCustomer(t);
    const admin = await adminLogin(t);
    assert.equal((await t.api(`/api/admin/customers/${c.id}/block`, { cookie: admin, body: { blocked: true } })).status, 200);
    assert.equal((await t.api("/api/auth/me", { cookie: c.cookie })).status, 401);
    const again = await t.api("/api/auth/login", { body: { email: c.email, password: "customer-pass-123" } });
    assert.equal(again.status, 403);
    assert.equal(again.json.error, "account_blocked");
  });

  test("a forged Google token is rejected", async () => {
    const fake = [{ alg: "RS256", kid: "x" }, { iss: "https://accounts.google.com", aud: "test-client-id.apps.googleusercontent.com", sub: "1", email: "victim@gmail.com", email_verified: true, exp: 4102444800 }]
      .map((p) => Buffer.from(JSON.stringify(p)).toString("base64url"))
      .join(".");
    const r = await t.api("/api/auth/google", { body: { credential: `${fake}.c2lnbmF0dXJl` } });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, "google_failed");
  });
});

describe("admin sessions", () => {
  test("admin cookie is HttpOnly, Secure and SameSite=Strict", async () => {
    const r = await t.api("/api/admin/login", { body: ADMIN });
    const set = r.headers.getSetCookie().join("\n");
    assert.match(set, /vendora_admin=[^;]+;.*HttpOnly/);
    assert.match(set, /Secure/);
    assert.match(set, /SameSite=Strict/);
  });

  test("logging out invalidates the cookie on the server", async () => {
    const cookie = await adminLogin(t);
    assert.equal((await t.api("/api/admin/session", { cookie })).status, 200);
    await t.api("/api/admin/logout", { method: "POST", cookie });
    assert.equal((await t.api("/api/admin/session", { cookie })).status, 401);
  });

  test("'log out on all devices' ends every admin session", async () => {
    const one = await adminLogin(t);
    const two = await adminLogin(t);
    await t.api("/api/admin/logout-all", { method: "POST", cookie: one });
    assert.equal((await t.api("/api/admin/session", { cookie: one })).status, 401);
    assert.equal((await t.api("/api/admin/session", { cookie: two })).status, 401);
  });
});
