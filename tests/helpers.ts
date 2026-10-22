/**
 * Security test helpers: runs the real API (server/app.ts) against a separate TEST database.
 *
 *   TEST_DATABASE_URL            postgres://vendora_app:…@127.0.0.1:5432/vendora_test
 *   TEST_MIGRATION_DATABASE_URL  postgres://vendora_owner:…@127.0.0.1:5432/vendora_test
 *
 * Put them in .env.local (or the environment). The database name must contain "test":
 * every test file wipes customers and orders and re-seeds the products, so it must never
 * point at your real shop.
 *
 * The server runs with NODE_ENV=production (CSP, HSTS, Secure cookies, strict admin
 * password) so the tests check what visitors really get.
 */
import { spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { env, loadEnv } from "../server/env";

export const ADMIN = { username: "admin", password: "Test-Admin-Passw0rd-7f3k9q2m" };

const root = path.resolve(import.meta.dirname, "..");

/** Configures the environment for the server code — must run before it's imported. */
function configure() {
  loadEnv(root);
  const url = env("TEST_DATABASE_URL");
  const owner = env("TEST_MIGRATION_DATABASE_URL") ?? url;
  if (!url || !owner) {
    throw new Error("Set TEST_DATABASE_URL (and TEST_MIGRATION_DATABASE_URL) to a separate test database — see tests/README.md");
  }
  for (const u of [url, owner]) {
    if (!/test/i.test(new URL(u).pathname)) throw new Error(`Refusing to run: the test database name must contain "test" (got ${new URL(u).pathname}). Tests delete data.`);
  }
  Object.assign(process.env, {
    NODE_ENV: "production",
    DATABASE_URL: url,
    MIGRATION_DATABASE_URL: owner,
    ADMIN_USERNAME: ADMIN.username,
    ADMIN_PASSWORD: ADMIN.password,
    ADMIN_SESSION_SECRET: "test-session-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
    // Each test acts as a different visitor through a (local) proxy
    TRUST_PROXY: "1",
    GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
    // Test uploads never land in public/
    UPLOAD_DIR: path.join(tmpdir(), "vendora-test-uploads"),
  });
  return { url, owner };
}

/** Migrates, wipes customer data and re-seeds the products in the test database. */
async function resetDatabase(owner: string) {
  const run = (script: string) => {
    const r = spawnSync(process.execPath, ["--import", "tsx", script], { cwd: root, env: process.env, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${script} failed:\n${r.stdout}\n${r.stderr}`);
  };
  run("scripts/migrate.ts");
  const client = new pg.Client({ connectionString: owner });
  await client.connect();
  await client.query("TRUNCATE users, orders, login_attempts, admin_sessions, sessions, admin_audit_log, stock_movements, admin_seen RESTART IDENTITY CASCADE");
  await client.end();
  run("scripts/seed-db.ts");
}

export type TestServer = {
  base: string;
  api: (path: string, opts?: RequestOpts) => Promise<ApiResponse>;
  db: pg.Client;
  close: () => Promise<void>;
};

type RequestOpts = { method?: string; body?: unknown; raw?: string | Buffer; cookie?: string; headers?: Record<string, string>; ip?: string };
export type ApiResponse = { status: number; json: any; text: string; headers: Headers; cookie: string | null };

let ipCounter = 0;
/** A fresh visitor address (TEST-NET range), so rate limits of one test don't affect another. */
export const newIp = () => `198.51.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

/** Starts the API on a random port, against a freshly reset test database. */
export async function startServer(): Promise<TestServer> {
  const { url, owner } = configure();
  await resetDatabase(owner);
  const { handleApi, guardAdminPage } = await import("../server/app");
  const { applySecurity } = await import("../server/security");

  const server: Server = createServer(async (req, res) => {
    try {
      if (await applySecurity(req, res)) return;
      if (await handleApi(req, res)) return;
      if (await guardAdminPage(req, res)) return;
      res.statusCode = 404;
      res.end("not found");
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const db = new pg.Client({ connectionString: url });
  await db.connect();

  const api = async (p: string, opts: RequestOpts = {}): Promise<ApiResponse> => {
    const headers: Record<string, string> = { "X-Forwarded-For": opts.ip ?? newIp(), ...opts.headers };
    if (opts.cookie) headers.Cookie = opts.cookie;
    let body: string | Buffer | undefined = opts.raw;
    if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["Content-Type"] ??= "application/json";
    }
    const res = await fetch(base + p, { method: opts.method ?? (body !== undefined ? "POST" : "GET"), headers, body: typeof body === "string" || body === undefined ? body : new Uint8Array(body), redirect: "manual" });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    // "name=value" of the first Set-Cookie, ready to send back
    const set = res.headers.getSetCookie();
    const cookie = set.length ? set.map((c) => c.split(";")[0]).join("; ") : null;
    return { status: res.status, json, text, headers: res.headers, cookie };
  };

  return {
    base,
    api,
    db,
    close: async () => {
      await db.end();
      await new Promise((r) => server.close(r));
      const { closePool } = await import("../server/db/pool");
      await closePool();
    },
  };
}

/** Registers a customer and returns their session cookie. */
export async function registerCustomer(t: TestServer, name = "Test Customer") {
  const email = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@example.test`;
  const r = await t.api("/api/auth/register", { body: { name, email, password: "customer-pass-123", locale: "en" } });
  if (r.status !== 201 || !r.cookie) throw new Error(`register failed: ${r.status} ${r.text}`);
  return { email, cookie: r.cookie, id: r.json.user.id as string };
}

/** Signs in as the admin and returns the cookie. */
export async function adminLogin(t: TestServer) {
  const r = await t.api("/api/admin/login", { body: ADMIN });
  if (r.status !== 200 || !r.cookie) throw new Error(`admin login failed: ${r.status} ${r.text}`);
  return r.cookie;
}

/** A valid order body for a product that's in stock in the seed data. */
export const orderBody = (extra: Record<string, unknown> = {}) => ({
  items: [{ productId: "p14", size: "Face cloth", colour: "Chalk", quantity: 1 }],
  address: { fullName: "Test Person", line1: "1 Test St", city: "Portland", region: "OR", postalCode: "97205", country: "US", phone: "555 010 2030" },
  deliveryOption: "standard",
  payment: { method: "wallet" },
  ...extra,
});
