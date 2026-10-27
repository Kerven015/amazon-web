/**
 * Small security rules that don't need a database or a server.
 */
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { describe, test } from "node:test";
import { safeNext } from "../src/lib/account-schema";
import { computeTotals, discountAmount } from "../src/lib/pricing";

process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_SESSION_SECRET = "unit-test-secret-0123456789-abcdefghijklmnop";
const { adminConfigProblems, authConfig, clientIp } = await import("../server/auth");

describe("open redirects", () => {
  test("only paths on this site are accepted after sign-in", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "http:/evil.example", "\t//evil.example", "/%0d%0aSet-Cookie:x"]) {
      const out = safeNext(bad, "/en/account");
      assert.ok(out === "/en/account" || (out.startsWith("/") && !out.startsWith("//") && !out.startsWith("/\\")), `${bad} → ${out}`);
      assert.ok(!/evil/.test(new URL(out, "https://shop.example").host), `${bad} must stay on the shop`);
    }
    assert.equal(safeNext("/en/checkout?x=1", "/en/account"), "/en/checkout?x=1");
  });
});

describe("visitor IP for rate limits", () => {
  const req = (peer: string, xff?: string) => ({ socket: { remoteAddress: peer }, headers: xff ? { "x-forwarded-for": xff } : {} }) as unknown as IncomingMessage;
  test("direct visitors can't fake X-Forwarded-For", () => {
    delete process.env.TRUST_PROXY;
    assert.equal(clientIp(req("203.0.113.5", "1.2.3.4")), "203.0.113.5");
  });
  test("a proxy on this machine is trusted, using the entry it added", () => {
    delete process.env.TRUST_PROXY;
    assert.equal(clientIp(req("127.0.0.1", "6.6.6.6, 198.51.100.7")), "198.51.100.7");
    assert.equal(clientIp(req("::1", "198.51.100.8")), "198.51.100.8");
  });
  test("TRUST_PROXY=1 trusts a remote proxy; TRUST_PROXY=0 trusts nobody", () => {
    process.env.TRUST_PROXY = "1";
    assert.equal(clientIp(req("10.0.0.2", "198.51.100.9")), "198.51.100.9");
    process.env.TRUST_PROXY = "0";
    assert.equal(clientIp(req("127.0.0.1", "198.51.100.9")), "127.0.0.1");
    delete process.env.TRUST_PROXY;
  });
});

describe("admin password rules", () => {
  for (const [pw, ok] of [
    ["change-me", false],
    ["short-pass-123", false],
    ["aaaaaaaaaaaaaaaaaaaa", false],
    ["admin", false],
    ["Kx8pQ2vN7rLm4tWz9bYc", true],
  ] as const) {
    test(`${pw.length} characters → ${ok ? "accepted" : "refused"}`, () => {
      process.env.ADMIN_PASSWORD = pw;
      assert.equal(adminConfigProblems().length === 0, ok);
    });
  }
});

describe("totals", () => {
  test("discounts and totals are worked out the same way everywhere", () => {
    assert.equal(discountAmount(100, "WELCOME10"), 10);
    assert.equal(discountAmount(100, "NOT-A-CODE"), 0);
    const t = computeTotals(100, 0, 10);
    assert.equal(t.total, 90);
    assert.ok(t.tax > 0 && t.tax < t.total);
  });
});

describe("dev server opened to other devices (DEV_EXPOSE)", () => {
  test("a weak admin password works locally but not when the dev server is exposed", () => {
    process.env.ADMIN_PASSWORD = "change-me";
    delete process.env.VENDORA_EXPOSED;
    assert.ok(authConfig(), "local development: allowed (with a warning)");
    process.env.VENDORA_EXPOSED = "1";
    assert.equal(authConfig(), null, "exposed: admin login switched off");
    process.env.ADMIN_PASSWORD = "Kx8pQ2vN7rLm4tWz9bYc";
    assert.ok(authConfig(), "exposed with a strong password: allowed");
    delete process.env.VENDORA_EXPOSED;
  });
});
