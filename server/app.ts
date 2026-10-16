/**
 * HTTP handlers shared by the Vite dev server (server/vite-plugin.ts) and the
 * production server (server/index.ts).
 *
 *   Public   GET  /api/products                 visible products only
 *            GET  /sitemap.xml                  (no /admin URLs)
 *   Auth     POST /api/admin/login              { username, password }
 *            POST /api/admin/logout
 *            GET  /api/admin/session
 *   Admin    GET  /api/admin/products           incl. hidden
 *            POST /api/admin/products           create (also used by "Undo delete")
 *            PUT  /api/admin/products/:id       update
 *            DELETE /api/admin/products/:id     delete one
 *            POST /api/admin/products/delete    { ids: [] } bulk delete
 *            POST /api/admin/products/restore   { ids: [] } undo a delete (within 10 minutes)
 *            POST /api/admin/upload?slug=&name= raw image body → WebP
 *
 * Every /api/admin/* route except login requires a valid session cookie (401 otherwise),
 * and /admin pages without a session redirect to /admin/login.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { productSchema, fieldErrors } from "../src/lib/product-schema";
import type { ProductRecord as Product } from "../src/types";
import {
  authConfig,
  checkCredentials,
  clearFailures,
  clearSessionCookie,
  clientIp,
  lockRemaining,
  recordFailure,
  sessionFrom,
  setSessionCookie,
  signSession,
} from "./auth";
import * as db from "./lib/db/products";
import { isLocale, LOCALE_COOKIE, locales, negotiateLocale, splitLocale, UNPREFIXED } from "../src/i18n/config";
import { MAX_UPLOAD_BYTES, saveUpload, UploadError } from "./upload";

type Req = IncomingMessage;
type Res = ServerResponse;

/* ------------------------------ helpers ------------------------------ */

function send(res: Res, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

class BodyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function readBody(req: Req, limit: number, tooLarge = "Request is too large"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > limit) {
      reject(new BodyError(413, tooLarge));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new BodyError(413, tooLarge));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req: Req, limit = 2 * 1024 * 1024): Promise<unknown> {
  const buf = await readBody(req, limit);
  try {
    return JSON.parse(buf.toString("utf8") || "{}");
  } catch {
    throw new BodyError(400, "Invalid JSON");
  }
}

/** Same-origin check for state-changing requests (defence in depth on top of SameSite=Strict). */
function sameOrigin(req: Req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    // Behind a proxy / port forwarding (Codespaces, VS Code tunnels) the public host
    // arrives in X-Forwarded-Host while Host may be localhost:5173
    const host = new URL(origin).host;
    const forwarded = String(req.headers["x-forwarded-host"] ?? "").split(",")[0].trim();
    return host === req.headers.host || (!!forwarded && host === forwarded);
  } catch {
    return false;
  }
}

/** Server-side derivations so the stored product is always consistent. */
function finalize(input: Product): Product {
  const prices = input.sizes.map((s) => (s.salePrice != null && s.salePrice < s.price ? { price: s.salePrice, list: s.price } : { price: s.price, list: undefined as number | undefined }));
  const cheapest = prices.reduce((a, b) => (b.price < a.price ? b : a));
  const stock = input.sizes.reduce((n, s) => n + Object.values(s.stock).reduce((a, b) => a + b, 0), 0);
  const onSale = prices.some((p) => p.list);
  const tags = new Set(input.tags ?? []);
  if (onSale) tags.add("deal");
  else tags.delete("deal");
  const oneSize = input.sizes.length === 1 && input.sizes[0].name === "One size";
  const real = (src?: string) => !!src && !src.startsWith("data:");
  return {
    ...input,
    images: input.images.filter((i) => real(i.src)),
    price: cheapest.price,
    listPrice: cheapest.list,
    stock,
    tags: [...tags],
    variants: { ...input.variants, sizes: oneSize ? undefined : input.sizes.map((s) => s.name) },
    reviews: (input.reviews ?? []).map((r) => ({ ...r, productId: input.id })),
    // The count and average always describe the reviews that exist
    ...(input.reviews?.length
      ? { reviewCount: input.reviews.length, rating: Math.round((input.reviews.reduce((n, r) => n + r.rating, 0) / input.reviews.length) * 10) / 10 }
      : {}),
  };
}

function validate(body: unknown) {
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error) };
  return { ok: true as const, product: finalize(parsed.data as Product) };
}

/* ------------------------------ undo ------------------------------ */

/** Recently deleted products, kept briefly so "Undo" restores them exactly. */
const trash = new Map<string, { product: Product; at: number }>();
const TRASH_MS = 10 * 60 * 1000;
function toTrash(products: Product[]) {
  const now = Date.now();
  for (const [id, t] of trash) if (now - t.at > TRASH_MS) trash.delete(id);
  for (const p of products) trash.set(p.id, { product: p, at: now });
}

/* ------------------------------ sitemap ------------------------------ */

async function sitemap(req: Req, res: Res) {
  const origin = `${req.headers["x-forwarded-proto"] ?? "http"}://${req.headers.host}`;
  const { collections } = await import("../src/lib/collections");
  const products = await db.getProducts();
  const paths = ["", ...collections.map((c) => `/collections/${c.slug}`), ...products.map((p) => `/products/${p.slug}`)];
  // Every page in every language, each listing its alternates (no /admin URLs)
  const alternates = (path: string) =>
    [...locales.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${origin}/${l}${path}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en${path}"/>`].join("\n");
  const urls = paths.flatMap((path) => locales.map((l) => `  <url>\n    <loc>${origin}/${l}${path}</loc>\n${alternates(path)}\n  </url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.end(xml);
}

/* ------------------------------ language ------------------------------ */

function cookieValue(req: Req, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Saved choice (cookie) first, then the browser's Accept-Language (tr → tr, tk → tk, else en). */
export function requestLocale(req: Req) {
  const saved = cookieValue(req, LOCALE_COOKIE);
  return isLocale(saved) ? saved : negotiateLocale(req.headers["accept-language"]);
}

/**
 * Shop pages without a language prefix ("/", "/collections/x") → "/{locale}/…".
 * Only for page requests; assets, /api and /admin are left alone.
 */
export function localeRedirect(req: Req, res: Res): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const url = new URL(req.url ?? "/", "http://x");
  const p = url.pathname;
  const wantsHtml = String(req.headers.accept ?? "").includes("text/html");
  if (!wantsHtml || UNPREFIXED.test(p) || splitLocale(p).locale || /\.[a-z0-9]+$/i.test(p) || /^\/(@|src\/|node_modules\/)/.test(p)) return false;
  res.statusCode = 302;
  res.setHeader("Vary", "Cookie, Accept-Language");
  res.setHeader("Location", `/${requestLocale(req)}${p === "/" ? "" : p}${url.search}`);
  res.end();
  return true;
}

/** <html lang> for the first paint: /tr/… → "tr". */
export function htmlLangFor(pathname: string) {
  return splitLocale(pathname).locale ?? "en";
}

export function withHtmlLang(html: string, pathname: string) {
  return html.replace(/<html([^>]*)\slang="[^"]*"/, `<html$1 lang="${htmlLangFor(pathname)}"`);
}

/* ------------------------------ page guard ------------------------------ */

const isAdminPage = (p: string) => p === "/admin" || p.startsWith("/admin/");

/**
 * The middleware for /admin pages: no valid session → 302 to /admin/login.
 * Returns true when it has answered the request.
 */
export function guardAdminPage(req: Req, res: Res): boolean {
  const url = new URL(req.url ?? "/", "http://x");
  if (!isAdminPage(url.pathname) || (req.method !== "GET" && req.method !== "HEAD")) return false;
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const loggedIn = !!sessionFrom(req);
  if (url.pathname === "/admin/login") {
    if (loggedIn) {
      res.statusCode = 302;
      res.setHeader("Location", "/admin");
      res.end();
      return true;
    }
    return false;
  }
  if (!loggedIn) {
    res.statusCode = 302;
    res.setHeader("Location", `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
    res.end();
    return true;
  }
  return false;
}

/* ------------------------------ API ------------------------------ */

/** Handles /api/* and /sitemap.xml. Returns true when the request was handled. */
export async function handleApi(req: Req, res: Res): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://x");
  const p = url.pathname;
  const method = req.method ?? "GET";

  if (p === "/sitemap.xml" && method === "GET") {
    await sitemap(req, res);
    return true;
  }
  if (!p.startsWith("/api/")) return false;

  try {
    /* ---- public ---- */
    if (p === "/api/products" && method === "GET") {
      send(res, 200, await db.getProducts());
      return true;
    }

    if (!p.startsWith("/api/admin/")) {
      send(res, 404, { error: "Not found" });
      return true;
    }

    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (method !== "GET" && !sameOrigin(req)) {
      send(res, 403, { error: "Cross-origin request blocked" });
      return true;
    }

    /* ---- login (the only unauthenticated admin route) ---- */
    if (p === "/api/admin/login") {
      if (method !== "POST") return send(res, 405, { error: "Method not allowed" }), true;
      if (!authConfig()) {
        send(res, 500, { error: "Admin login isn't configured. Set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET (32+ chars) in .env.local." });
        return true;
      }
      const ip = clientIp(req);
      const locked = lockRemaining(ip);
      if (locked) {
        send(res, 429, { error: `Too many attempts. Try again in ${Math.ceil(locked / 60000)} minute${locked > 60000 ? "s" : ""}.`, retryAfter: Math.ceil(locked / 1000) }, { "Retry-After": String(Math.ceil(locked / 1000)) });
        return true;
      }
      const body = (await readJson(req, 10_000)) as { username?: unknown; password?: unknown };
      const username = typeof body.username === "string" ? body.username.slice(0, 200) : "";
      const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
      if (!checkCredentials(username, password)) {
        const r = recordFailure(ip);
        if (r.locked) send(res, 429, { error: "Too many attempts. Try again in 5 minutes.", retryAfter: 300 }, { "Retry-After": "300" });
        else send(res, 401, { error: "Incorrect username or password" });
        return true;
      }
      clearFailures(ip);
      setSessionCookie(req, res, signSession(username));
      send(res, 200, { ok: true });
      return true;
    }

    /* ---- everything below requires a session ---- */
    const session = sessionFrom(req);
    if (!session) {
      send(res, 401, { error: "Not signed in" });
      return true;
    }

    if (p === "/api/admin/logout" && method === "POST") {
      clearSessionCookie(req, res);
      send(res, 200, { ok: true });
      return true;
    }
    if (p === "/api/admin/session" && method === "GET") {
      send(res, 200, { username: session.sub, expiresAt: session.exp * 1000 });
      return true;
    }

    if (p === "/api/admin/products") {
      if (method === "GET") {
        send(res, 200, await db.getProducts({ includeHidden: true }));
        return true;
      }
      if (method === "POST") {
        const v = validate(await readJson(req));
        if (!v.ok) return send(res, 422, { error: "Please fix the highlighted fields", fields: v.errors }), true;
        send(res, 201, await db.createProduct(v.product));
        return true;
      }
    }

    if (p === "/api/admin/products/delete" && method === "POST") {
      const body = (await readJson(req, 100_000)) as { ids?: unknown };
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
      if (!ids.length) return send(res, 400, { error: "No products selected" }), true;
      const deleted = await db.deleteProducts(ids);
      toTrash(deleted);
      send(res, 200, { deleted: deleted.map((p) => p.id) });
      return true;
    }

    if (p === "/api/admin/products/restore" && method === "POST") {
      const body = (await readJson(req, 100_000)) as { ids?: unknown };
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
      const restored: string[] = [];
      for (const id of ids) {
        const t = trash.get(id);
        if (!t || Date.now() - t.at > TRASH_MS) continue;
        await db.createProduct(t.product);
        trash.delete(id);
        restored.push(id);
      }
      if (!restored.length) return send(res, 410, { error: "This product can no longer be restored" }), true;
      send(res, 200, { restored });
      return true;
    }

    const one = p.match(/^\/api\/admin\/products\/([A-Za-z0-9-]+)$/);
    if (one) {
      const id = one[1];
      if (method === "GET") {
        const product = await db.getProductById(id, { includeHidden: true });
        return send(res, product ? 200 : 404, product ?? { error: "Not found" }), true;
      }
      if (method === "PUT") {
        const v = validate({ ...((await readJson(req)) as object), id });
        if (!v.ok) return send(res, 422, { error: "Please fix the highlighted fields", fields: v.errors }), true;
        const saved = await db.updateProduct(id, v.product);
        return send(res, saved ? 200 : 404, saved ?? { error: "Not found" }), true;
      }
      if (method === "DELETE") {
        const removed = await db.deleteProduct(id);
        if (removed) toTrash([removed]);
        return send(res, removed ? 200 : 404, removed ? { deleted: [removed.id] } : { error: "Not found" }), true;
      }
    }

    if (p === "/api/admin/upload" && method === "POST") {
      const body = await readBody(req, MAX_UPLOAD_BYTES, "Images must be 5MB or smaller");
      const saved = await saveUpload(body, String(req.headers["content-type"] ?? ""), url.searchParams.get("slug") ?? "", url.searchParams.get("name") ?? "image");
      send(res, 201, saved);
      return true;
    }

    send(res, 404, { error: "Not found" });
    return true;
  } catch (err) {
    if (err instanceof db.ConflictError) send(res, 409, { error: "Please fix the highlighted fields", fields: err.fields });
    else if (err instanceof UploadError || err instanceof BodyError) send(res, err.status, { error: err.message });
    else {
      console.error("[api]", err);
      send(res, 500, { error: "Something went wrong on the server" });
    }
    return true;
  }
}
