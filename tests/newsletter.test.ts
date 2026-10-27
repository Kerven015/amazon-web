/**
 * Newsletter: sign-ups are stored (with proof of consent), unsubscribe links work and can't be
 * forged, and only the admin can see or export the list.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminLogin, newIp, registerCustomer, startServer, type TestServer } from "./helpers";

let t: TestServer;
let admin: string;
let unsubscribeToken: (id: string) => string;
before(async () => {
  t = await startServer();
  admin = await adminLogin(t);
  ({ unsubscribeToken } = await import("../server/lib/db/newsletter"));
});
after(async () => t?.close());

const signUp = (email: string, opts: { locale?: string; ip?: string; cookie?: string } = {}) =>
  t.api("/api/newsletter", { ip: opts.ip, cookie: opts.cookie, body: { email, locale: opts.locale ?? "en" } });
const row = async (email: string) => (await t.db.query("SELECT * FROM newsletter_subscribers WHERE email = $1", [email])).rows[0];

describe("signing up", () => {
  test("the email is saved with the language, time, address and the consent text shown", async () => {
    const r = await signUp("Reader.One@Example.test", { locale: "tr" });
    assert.equal(r.status, 200, r.text);
    const s = await row("reader.one@example.test");
    assert.ok(s, "stored (lower-cased)");
    assert.equal(s.locale, "tr");
    assert.match(s.consent_text, /Vendora/);
    assert.match(s.consent_text, /Gizlilik|gizlilik/i, "the Turkish sentence the visitor saw");
    assert.ok(s.ip);
    assert.equal(s.unsubscribed_at, null);
  });

  test("signing up twice gives the same answer and keeps one row (no way to probe who's subscribed)", async () => {
    const a = await signUp("twice@example.test");
    const b = await signUp("twice@example.test");
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.deepEqual(a.json, b.json);
    assert.equal((await t.db.query("SELECT count(*)::int AS n FROM newsletter_subscribers WHERE email = 'twice@example.test'")).rows[0].n, 1);
  });

  test("a signed-in customer's sign-up is linked to their account", async () => {
    const c = await registerCustomer(t);
    await signUp(c.email, { cookie: c.cookie });
    assert.equal((await row(c.email)).user_id, c.id);
  });

  test("bad input, other sites and scripts are refused", async () => {
    for (const email of ["", "no-at-sign", "a@b", "x".repeat(300) + "@example.test"]) assert.equal((await signUp(email)).status, 422, email);
    assert.equal((await t.api("/api/newsletter", { body: { email: "x@example.test", locale: "de" } })).status, 422);
    assert.equal((await t.api("/api/newsletter", { body: { email: "evil@example.test" }, headers: { Origin: "https://evil.example" } })).status, 403);
    const ip = newIp();
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await signUp(`bulk${i}@example.test`, { ip })).status);
    assert.equal(codes.filter((c) => c === 200).length, 10);
    assert.equal(codes.at(-1), 429);
  });
});

describe("unsubscribing", () => {
  test("the link unsubscribes; signing up again re-subscribes", async () => {
    await signUp("leaver@example.test");
    const s = await row("leaver@example.test");
    const r = await t.api("/api/newsletter/unsubscribe", { body: { token: unsubscribeToken(s.id) } });
    assert.equal(r.status, 200, r.text);
    assert.ok((await row("leaver@example.test")).unsubscribed_at);
    // Clicking the link again is fine
    assert.equal((await t.api("/api/newsletter/unsubscribe", { body: { token: unsubscribeToken(s.id) } })).status, 200);
    await signUp("leaver@example.test");
    assert.equal((await row("leaver@example.test")).unsubscribed_at, null);
  });

  test("forged or broken links don't work", async () => {
    await signUp("victim@example.test");
    const s = await row("victim@example.test");
    const good = unsubscribeToken(s.id);
    for (const token of ["", s.id, `${s.id}.${"A".repeat(43)}`, good.slice(0, -1) + (good.endsWith("A") ? "B" : "A"), "../../etc/passwd"]) {
      assert.equal((await t.api("/api/newsletter/unsubscribe", { body: { token } })).status, 404, token);
    }
    assert.equal((await row("victim@example.test")).unsubscribed_at, null);
  });
});

describe("admin", () => {
  test("only the admin can list, export or delete subscribers", async () => {
    const c = await registerCustomer(t);
    for (const [method, path] of [["GET", "/api/admin/newsletter"], ["GET", "/api/admin/newsletter/export"], ["DELETE", "/api/admin/newsletter/00000000-0000-0000-0000-000000000000"]]) {
      for (const cookie of [undefined, c.cookie]) assert.equal((await t.api(path, { method, cookie })).status, 401, path);
    }
  });

  test("the list and counts match the database", async () => {
    const r = await t.api("/api/admin/newsletter?status=all", { cookie: admin });
    const db = (await t.db.query("SELECT count(*) FILTER (WHERE unsubscribed_at IS NULL)::int AS sub, count(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsub FROM newsletter_subscribers")).rows[0];
    assert.deepEqual(r.json.counts, { subscribed: db.sub, unsubscribed: db.unsub });
    assert.equal(r.json.subscribers.length, db.sub + db.unsub);
  });

  test("the export has everyone still subscribed, each with a working unsubscribe link, and nobody who left", async () => {
    await signUp("gone@example.test");
    await t.api("/api/newsletter/unsubscribe", { body: { token: unsubscribeToken((await row("gone@example.test")).id) } });
    const r = await t.api("/api/admin/newsletter/export", { cookie: admin, headers: { Host: "shop.example.test" } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /^text\/csv/);
    const lines = r.text.replace(/^﻿/, "").trim().split("\r\n");
    assert.equal(lines[0], "email,language,subscribed_at,unsubscribe_url");
    assert.ok(!r.text.includes("gone@example.test"));
    const active = (await t.db.query("SELECT count(*)::int AS n FROM newsletter_subscribers WHERE unsubscribed_at IS NULL")).rows[0].n;
    assert.equal(lines.length - 1, active);
    // The link in the export really unsubscribes that person
    const line = lines.find((l) => l.startsWith("victim@example.test"))!;
    const token = new URL(line.split(",")[3]).searchParams.get("token")!;
    assert.match(line, /\/en\/newsletter\/unsubscribe\?token=/);
    assert.equal((await t.api("/api/newsletter/unsubscribe", { body: { token } })).status, 200);
    assert.ok((await row("victim@example.test")).unsubscribed_at);
  });

  test("deleting removes the row for good and logs it without the email", async () => {
    await signUp("erase-me@example.test");
    const id = (await row("erase-me@example.test")).id;
    assert.equal((await t.api(`/api/admin/newsletter/${id}`, { method: "DELETE", cookie: admin })).status, 200);
    assert.equal(await row("erase-me@example.test"), undefined);
    const entry = (await t.db.query("SELECT * FROM admin_audit_log WHERE action = 'newsletter.delete' ORDER BY id DESC LIMIT 1")).rows[0];
    assert.equal(entry.entity_id, id);
    assert.doesNotMatch(JSON.stringify(entry.details), /erase-me/);
    assert.equal((await t.api(`/api/admin/newsletter/${id}`, { method: "DELETE", cookie: admin })).status, 404);
  });
});
