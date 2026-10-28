/**
 * HTTP handlers shared by the Vite dev server (server/vite-plugin.ts) and the
 * production server (server/index.ts).
 *
 *   Public   GET  /api/products                 visible products only
 *            GET  /sitemap.xml                  (no /admin URLs)
 *   Auth     POST /api/admin/login              { username, password }
 *            POST /api/admin/logout             ends this admin session on the server
 *            POST /api/admin/logout-all         ends every admin session (e.g. a cookie may have leaked)
 *            GET  /api/admin/session
 *   Admin    GET  /api/admin/products           incl. hidden
 *            POST /api/admin/products           create (also used by "Undo delete")
 *            PUT  /api/admin/products/:id       update
 *            DELETE /api/admin/products/:id     delete one
 *            POST /api/admin/products/delete    { ids: [] } bulk delete
 *            POST /api/admin/products/restore   { ids: [] } undo a delete (within 10 minutes)
 *            POST /api/admin/upload?slug=&name= raw image body → WebP
 *            GET  /api/admin/orders?q=&status=&from=&to=&sort=   orders (newest first by default)
 *            PATCH /api/admin/orders/:id/status { status } → adds a tracking event (forward only; 409 otherwise)
 *            GET  /api/admin/customers?q=       customer accounts (who's signed in, orders, spend)
 *            GET  /api/admin/customers/:id      one customer, with their signed-in devices
 *            POST /api/admin/customers/:id/sign-out           end every session
 *            DELETE /api/admin/customers/:id/sessions/:sid    end one device's session
 *            POST /api/admin/customers/:id/block { blocked }  block (also signs out) / unblock
 *            DELETE /api/admin/customers/:id    delete (only accounts without orders)
 *   Tools    dashboard, order detail & shipment, inventory, reviews, reports, settings,
 *            activity log → server/admin-api.ts
 *   Shop     /api/auth/*, /api/account/*, /api/orders, /api/products/:id/reviews → server/shop-api.ts
 *
 * Every /api/admin/* route except login requires a valid admin session cookie (401 otherwise),
 * and /admin pages without a session redirect to /admin/login.
 * Every state-changing request (POST/PUT/PATCH/DELETE) must pass the same-origin check,
 * and every admin change is written to the activity log (admin_audit_log).
 */
import { productSchema, fieldErrors } from "../src/lib/product-schema";
import { orderStatusSchema } from "../src/lib/account-schema";
import { ADMIN_BASE, adminPath, isAdminPath } from "../src/lib/admin-path";
import type { ProductRecord as Product } from "../src/types";
import {
  authConfig,
  checkCredentials,
  clearFailures,
  clientIp,
  endAdminSession,
  endAllAdminSessions,
  lockRemaining,
  readCookie,
  recordFailure,
  sessionFrom,
  startAdminSession,
} from "./auth";
import * as db from "./lib/db/products";
import { adminListOrders, adminSetStatus, StatusError } from "./lib/db/orders";
import { logAdmin } from "./lib/db/audit";
import { type Audit, handleAdminTools } from "./admin-api";
import * as customers from "./lib/db/customers";
import { z } from "zod";
import { BodyError, parseBody, parseQuery, publicOrigin, readBody, readJson, type Req, type Res, sameOrigin, send, ValidationError } from "./http";
import { handleShopApi } from "./shop-api";
import { isLocale, LOCALE_COOKIE, locales, negotiateLocale, splitLocale, UNPREFIXED } from "../src/i18n/config";
import { MAX_UPLOAD_BYTES, saveUpload, UploadError } from "./upload";

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
    variants: {
      ...input.variants,
      sizes: oneSize ? undefined : input.sizes.map((s) => s.name),
      // A colour's own photos (uploaded per colour): the first one is also its swatch photo
      colors: input.variants.colors?.map((c) => {
        const own = (c.images ?? []).filter((i) => real(i.src));
        return own.length ? { ...c, images: own, image: own[0].src, imageBlur: own[0].blurDataURL } : { ...c, images: undefined };
      }),
    },
    reviews: (input.reviews ?? []).map((r) => ({ ...r, productId: input.id })),
    // The count and average always describe the reviews that exist
    ...(input.reviews?.length
      ? { reviewCount: input.reviews.length, rating: Math.round((input.reviews.reduce((n, r) => n + r.rating, 0) / input.reviews.length) * 10) / 10 }
      : {}),
  };
}

/** What an admin product save changed, for the activity log (field names, and prices per size). */
function productChanges(before: Product, after: Product) {
  const skip = new Set(["reviews", "rating", "reviewCount", "stock", "updatedAt"]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [...keys].filter((k) => !skip.has(k) && JSON.stringify(before[k as keyof Product]) !== JSON.stringify(after[k as keyof Product]));
  const prices = after.sizes.flatMap((s) => {
    const old = before.sizes.find((b) => b.name === s.name);
    return old && (old.price !== s.price || (old.salePrice ?? null) !== (s.salePrice ?? null))
      ? [{ size: s.name, price: [old.price, s.price], salePrice: [old.salePrice ?? null, s.salePrice ?? null] }]
      : [];
  });
  return { slug: after.slug, changed, ...(prices.length ? { prices } : {}) };
}

const ordersQuery = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["open", "placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(["newest", "oldest", "total_desc", "total_asc"]).optional(),
});

function validate(body: unknown) {
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error) };
  return { ok: true as const, product: finalize(parsed.data as Product) };
}

/* ------------------------------ sitemap ------------------------------ */

async function sitemap(req: Req, res: Res) {
  const origin = publicOrigin(req);
  if (!origin) return send(res, 400, { error: "Bad Host header" });
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

/** Saved choice (cookie) first, then the browser's Accept-Language (tr → tr, tk → tk, else en). */
export function requestLocale(req: Req) {
  const saved = readCookie(req, LOCALE_COOKIE);
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

/** The admin's pages (src/lib/admin-path.ts). "%40" is the same as "@", so it's decoded first. */
function isAdminPage(p: string) {
  try {
    return isAdminPath(decodeURIComponent(p));
  } catch {
    return false;
  }
}

/**
 * The middleware for admin pages (/manager@…): no valid session → 302 to /manager@/login.
 * The old /admin address is just an unknown page now (nothing points to the new one).
 * Returns true when it has answered the request.
 */
export async function guardAdminPage(req: Req, res: Res): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://x");
  if (!isAdminPage(url.pathname) || (req.method !== "GET" && req.method !== "HEAD")) return false;
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const loggedIn = !!(await sessionFrom(req));
  if (decodeURIComponent(url.pathname) === adminPath("/login")) {
    if (loggedIn) {
      res.statusCode = 302;
      res.setHeader("Location", ADMIN_BASE);
      res.end();
      return true;
    }
    return false;
  }
  if (!loggedIn) {
    res.statusCode = 302;
    res.setHeader("Location", `${adminPath("/login")}?next=${encodeURIComponent(url.pathname + url.search)}`);
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

    if (method !== "GET" && method !== "HEAD" && !sameOrigin(req)) {
      send(res, 403, { error: "Cross-origin request blocked" });
      return true;
    }

    if (!p.startsWith("/api/admin/")) {
      if (await handleShopApi(req, res, p, method)) return true;
      send(res, 404, { error: "not_found" });
      return true;
    }

    res.setHeader("X-Robots-Tag", "noindex, nofollow");

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
        const mins = Math.max(1, Math.ceil(r.retryAfterMs / 60000));
        if (r.locked) send(res, 429, { error: `Too many attempts. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`, retryAfter: Math.ceil(r.retryAfterMs / 1000) }, { "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)) });
        else send(res, 401, { error: "Incorrect username or password" });
        return true;
      }
      clearFailures(ip);
      await startAdminSession(req, res, username);
      await logAdmin({ actor: username, action: "admin.login", entityType: "admin", entityId: username, ip });
      send(res, 200, { ok: true });
      return true;
    }

    /* ---- everything below requires a session ---- */
    const session = await sessionFrom(req);
    if (!session) {
      send(res, 401, { error: "Not signed in" });
      return true;
    }

    if (p === "/api/admin/logout" && method === "POST") {
      await endAdminSession(req, res);
      send(res, 200, { ok: true });
      return true;
    }
    const audit: Audit = (e, db) => logAdmin({ ...e, actor: session.sub, ip: clientIp(req) }, db);

    if (p === "/api/admin/logout-all" && method === "POST") {
      const ended = await endAllAdminSessions(req, res);
      await audit({ action: "admin.logout_all", entityType: "admin", entityId: session.sub, details: { ended } });
      send(res, 200, { ended });
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
        const created = await db.createProduct(v.product, session.sub);
        await audit({ action: "product.create", entityType: "product", entityId: created.id, details: { slug: created.slug } });
        send(res, 201, created);
        return true;
      }
    }

    if (p === "/api/admin/products/delete" && method === "POST") {
      const body = (await readJson(req, 100_000)) as { ids?: unknown };
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
      if (!ids.length) return send(res, 400, { error: "No products selected" }), true;
      const deleted = await db.deleteProducts(ids);
      for (const d of deleted) await audit({ action: "product.delete", entityType: "product", entityId: d.id, details: { slug: d.slug } });
      send(res, 200, { deleted: deleted.map((p) => p.id) });
      return true;
    }

    if (p === "/api/admin/products/restore" && method === "POST") {
      const body = (await readJson(req, 100_000)) as { ids?: unknown };
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
      const restored = await db.restoreProducts(ids);
      if (!restored.length) return send(res, 410, { error: "This product can no longer be restored" }), true;
      for (const id of restored) await audit({ action: "product.restore", entityType: "product", entityId: id });
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
        const before = await db.getProductById(id, { includeHidden: true });
        const saved = await db.updateProduct(id, v.product, session.sub);
        if (saved && before) await audit({ action: "product.update", entityType: "product", entityId: id, details: productChanges(before, saved) });
        return send(res, saved ? 200 : 404, saved ?? { error: "Not found" }), true;
      }
      if (method === "DELETE") {
        const removed = await db.deleteProduct(id);
        if (removed) await audit({ action: "product.delete", entityType: "product", entityId: id, details: { slug: removed.slug } });
        return send(res, removed ? 200 : 404, removed ? { deleted: [removed.id] } : { error: "Not found" }), true;
      }
    }

    if (p === "/api/admin/orders" && method === "GET") {
      send(res, 200, await adminListOrders(parseQuery(url, ordersQuery)));
      return true;
    }
    const orderStatus = p.match(/^\/api\/admin\/orders\/(VD-\d{6})\/status$/);
    if (orderStatus && method === "PATCH") {
      const { status } = await parseBody(req, orderStatusSchema, 1_000);
      try {
        const result = await adminSetStatus(orderStatus[1], status, session.sub);
        if (!result) return send(res, 404, { error: "Not found" }), true;
        if (result.from !== status) await audit({ action: "order.status", entityType: "order", entityId: orderStatus[1], details: { from: result.from, to: status } });
        return send(res, 200, result.order), true;
      } catch (err) {
        if (err instanceof StatusError) return send(res, 409, { error: "invalid_transition", from: err.from }), true;
        throw err;
      }
    }

    if (p === "/api/admin/customers" && method === "GET") {
      send(res, 200, await customers.listCustomers(url.searchParams.get("q") ?? ""));
      return true;
    }
    const customer = p.match(/^\/api\/admin\/customers\/([0-9a-f-]{36})(?:\/(sign-out|block|sessions\/([0-9a-f]{64})))?$/i);
    if (customer) {
      const [, id, action, sessionId] = customer;
      const notFound = () => send(res, 404, { error: "Not found" });
      if (!action && method === "GET") {
        const detail = await customers.getCustomer(id);
        return detail ? send(res, 200, detail) : notFound(), true;
      }
      if (!action && method === "DELETE") {
        const result = await customers.deleteCustomer(id);
        if (result === "not_found") return notFound(), true;
        if (result === "has_orders") return send(res, 409, { error: "has_orders" }), true;
        await audit({ action: "customer.delete", entityType: "customer", entityId: id });
        return send(res, 200, { deleted: id }), true;
      }
      if (action === "sign-out" && method === "POST") {
        const ended = await customers.signOutCustomer(id);
        await audit({ action: "customer.sign_out", entityType: "customer", entityId: id, details: { ended } });
        return send(res, 200, { ended }), true;
      }
      if (action === "block" && method === "POST") {
        const { blocked } = await parseBody(req, z.object({ blocked: z.boolean() }), 1_000);
        if (!(await customers.setBlocked(id, blocked))) return notFound(), true;
        await audit({ action: blocked ? "customer.block" : "customer.unblock", entityType: "customer", entityId: id });
        return send(res, 200, await customers.getCustomer(id)), true;
      }
      if (sessionId && method === "DELETE") {
        if (!(await customers.endCustomerSession(id, sessionId))) return notFound(), true;
        await audit({ action: "customer.end_session", entityType: "customer", entityId: id });
        return send(res, 200, await customers.getCustomer(id)), true;
      }
    }

    if (p === "/api/admin/upload" && method === "POST") {
      const body = await readBody(req, MAX_UPLOAD_BYTES, "Images must be 5MB or smaller");
      const saved = await saveUpload(body, String(req.headers["content-type"] ?? ""), url.searchParams.get("slug") ?? "", url.searchParams.get("name") ?? "image");
      send(res, 201, saved);
      return true;
    }

    if (await handleAdminTools(req, res, url, method, session.sub, audit)) return true;

    send(res, 404, { error: "Not found" });
    return true;
  } catch (err) {
    if (err instanceof db.ConflictError) send(res, 409, { error: "Please fix the highlighted fields", fields: err.fields });
    else if (err instanceof ValidationError) send(res, 422, { error: "validation", fields: err.fields });
    else if (err instanceof UploadError || err instanceof BodyError) send(res, err.status, { error: err.message });
    else {
      console.error("[api]", err);
      // Never send raw database errors to the browser
      send(res, 500, { error: p.startsWith("/api/admin/") ? "Something went wrong on the server" : "server_error" });
    }
    return true;
  }
}
