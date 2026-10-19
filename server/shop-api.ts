/**
 * Customer API (all JSON, every body validated with zod, errors returned as codes
 * that the browser shows as translated messages — never raw SQL errors).
 *
 *   Auth      POST /api/auth/register          { name, email, password, locale }
 *             POST /api/auth/login             { email, password, remember }
 *             POST /api/auth/logout
 *             POST /api/auth/logout-all
 *             GET  /api/auth/me                → { id, name, email, locale } or 401
 *             GET  /api/auth/config            → { googleClientId } (public; null = Google sign-in off)
 *             POST /api/auth/google            { credential, locale } — "Continue with Google" / One Tap
 *   Account   GET|PATCH /api/account/profile   { name?, email?, currentPassword? }
 *             POST /api/account/password       { currentPassword, newPassword }
 *             GET|PUT   /api/account/cart      { items, mode }
 *             GET|POST  /api/account/addresses
 *             PATCH|DELETE /api/account/addresses/:id,  POST /api/account/addresses/:id/default
 *             GET|PUT|DELETE /api/account/wishlist,     DELETE /api/account/wishlist/:productId
 *             GET  /api/account/orders,  GET /api/account/orders/:id
 *             GET  /api/account/reviews        ids of the customer's own reviews
 *   Shop      POST /api/products/:id/reviews   { rating, title, body, author? }
 *             POST /api/orders                 (signed in only)
 *             GET  /api/orders/:id             only the customer who placed it; anyone else → 404
 */
import {
  addressPatchSchema,
  addressSchema,
  cartSchema,
  loginSchema,
  orderSchema,
  googleSignInSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
  reviewSchema,
  wishlistSchema,
  type ApiErrorCode,
} from "../src/lib/account-schema";
import { clientIp } from "./auth";
import {
  clearLoginFailures,
  customerFrom,
  endAllSessions,
  endSession,
  hashPassword,
  recordLoginFailure,
  type SessionUser,
  startSession,
  timingDummy,
  tooManyFailures,
  verifyPassword,
} from "./customer-auth";
import { GoogleTokenError, googleClientId, signInMethods, signInWithGoogle, verifyGoogleCredential } from "./google-auth";
import { parseBody, type Req, type Res, send } from "./http";
import * as account from "./lib/db/account";
import { rateLimit } from "./security";
import { getOrder, listOrders, OrderError, placeOrder } from "./lib/db/orders";

const fail = (res: Res, status: number, error: ApiErrorCode, extra: Record<string, unknown> = {}) => send(res, status, { error, ...extra });

const MIN15 = 15 * 60 * 1000;

/** Per-IP limits on the auth endpoints (each Argon2 hash costs ~20MB and real CPU time). */
function limited(req: Req, res: Res, name: string, max: number, key = clientIp(req)) {
  if (rateLimit(`${name}:${key}`, max, MIN15)) return false;
  fail(res, 429, "too_many_attempts");
  return true;
}

const publicUser = (u: { id: string; name: string; email: string; locale: string }) => ({ id: u.id, name: u.name, email: u.email, locale: u.locale });

/** Handles /api/auth/*, /api/account/*, /api/orders*, /api/products/:id/reviews. Returns true when handled. */
export async function handleShopApi(req: Req, res: Res, p: string, method: string): Promise<boolean> {
  /* ------------------------------ auth ------------------------------ */

  if (p === "/api/auth/register" && method === "POST") {
    if (limited(req, res, "register", 10)) return true;
    const body = await parseBody(req, registerSchema, 10_000);
    // Hash first: the response takes the same time whether or not the email exists
    const passwordHash = await hashPassword(body.password);
    const id = await account.createUser({ email: body.email, name: body.name, locale: body.locale, passwordHash });
    if (!id) return fail(res, 409, "email_taken"), true;
    await startSession(req, res, id, false);
    send(res, 201, { user: { id, name: body.name, email: body.email, locale: body.locale } });
    return true;
  }

  if (p === "/api/auth/login" && method === "POST") {
    // Per IP across all emails (password spraying), on top of the per IP + email limit below
    if (limited(req, res, "login", 30)) return true;
    const body = await parseBody(req, loginSchema, 10_000);
    const ip = clientIp(req);
    if (await tooManyFailures(ip, body.email)) return fail(res, 429, "too_many_attempts"), true;
    const user = await account.findUserByEmail(body.email);
    // Unknown email: still run a full Argon2 verify so timing doesn't reveal which part was wrong
    const ok = user ? await verifyPassword(user.password_hash, body.password) : (await verifyPassword(await timingDummy(), body.password), false);
    if (!user || !ok) {
      await recordLoginFailure(ip, body.email);
      return fail(res, 401, "invalid_credentials"), true;
    }
    await clearLoginFailures(ip, body.email);
    // Only someone with the right password learns that the account is blocked
    if (user.blocked_at) return fail(res, 403, "account_blocked"), true;
    await startSession(req, res, user.id, body.remember);
    send(res, 200, { user: publicUser(user) });
    return true;
  }

  if (p === "/api/auth/config" && method === "GET") {
    send(res, 200, { googleClientId: googleClientId() });
    return true;
  }

  if (p === "/api/auth/google" && method === "POST") {
    if (limited(req, res, "google", 30)) return true;
    const body = await parseBody(req, googleSignInSchema, 10_000);
    let profile;
    try {
      profile = await verifyGoogleCredential(body.credential);
    } catch (err) {
      if (err instanceof GoogleTokenError) return fail(res, 401, "google_failed"), true;
      throw err;
    }
    const result = await signInWithGoogle(profile, body.locale);
    if (result.blocked) return fail(res, 403, "account_blocked"), true;
    // Signing in with Google keeps you signed in on this device (30 days), like "Keep me signed in"
    await startSession(req, res, result.userId, true);
    send(res, result.created ? 201 : 200, { user: { id: result.userId, name: result.name, email: result.email, locale: result.locale }, created: result.created });
    return true;
  }

  if (p === "/api/auth/logout" && method === "POST") {
    await endSession(req, res);
    send(res, 200, { ok: true });
    return true;
  }

  if (p === "/api/auth/me" && method === "GET") {
    const user = await customerFrom(req, res);
    if (!user) return fail(res, 401, "sign_in_required"), true;
    send(res, 200, publicUser(user));
    return true;
  }

  const isAccount = p.startsWith("/api/account/") || p === "/api/auth/logout-all";
  const reviewMatch = p.match(/^\/api\/products\/([A-Za-z0-9-]+)\/reviews$/);
  const orderMatch = p.match(/^\/api\/orders(?:\/(VD-\d{6}))?$/);
  if (!isAccount && !reviewMatch && !orderMatch) return false;

  /* ---------------- everything below needs a signed-in customer ---------------- */
  const user = await customerFrom(req, res);
  if (!user) return fail(res, 401, "sign_in_required"), true;

  if (p === "/api/auth/logout-all" && method === "POST") {
    await endAllSessions(user.id);
    await endSession(req, res);
    send(res, 200, { ok: true });
    return true;
  }

  if (reviewMatch && method === "POST") return await createReview(req, res, user, reviewMatch[1]), true;

  if (orderMatch) {
    const id = orderMatch[1];
    if (!id && method === "POST") return await createOrder(req, res, user), true;
    if (id && method === "GET") return await sendOrder(res, user, id), true;
    return false;
  }

  return handleAccount(req, res, user, p.slice("/api/account".length), method);
}

const HOUR = 60 * 60 * 1000;

async function createReview(req: Req, res: Res, user: SessionUser, productId: string) {
  // Fake-review spam: 5 an hour per account, 20 an hour per address (several accounts)
  if (!rateLimit(`review:${user.id}`, 5, HOUR) || !rateLimit(`review-ip:${clientIp(req)}`, 20, HOUR)) return fail(res, 429, "too_many_attempts");
  const body = await parseBody(req, reviewSchema, 20_000);
  try {
    send(res, 201, await account.createReview(user, productId, body));
  } catch (err) {
    if (err instanceof account.ReviewError) fail(res, err.code === "not_found" ? 404 : 409, err.code);
    else throw err;
  }
}

async function createOrder(req: Req, res: Res, user: SessionUser) {
  // Many accounts from one address (the per-account caps are in placeOrder)
  if (!rateLimit(`order-ip:${clientIp(req)}`, 20, HOUR)) return fail(res, 429, "too_many_orders");
  const body = await parseBody(req, orderSchema, 50_000);
  try {
    // The order's email is always the account's email
    send(res, 201, await placeOrder({ id: user.id, email: user.email }, body));
  } catch (err) {
    if (err instanceof OrderError) fail(res, err.code === "out_of_stock" ? 409 : err.code === "too_many_orders" ? 429 : 422, err.code, err.lines.length ? { lines: err.lines } : {});
    else throw err;
  }
}

async function sendOrder(res: Res, user: SessionUser, id: string) {
  const order = await getOrder(user.id, id);
  if (!order) fail(res, 404, "not_found");
  else send(res, 200, order);
}

async function handleAccount(req: Req, res: Res, user: SessionUser, p: string, method: string): Promise<boolean> {
  /* ---- profile ---- */
  if (p === "/profile") {
    if (method === "GET") {
      send(res, 200, { ...publicUser(user), memberSince: user.createdAt, ...(await signInMethods(user.id)) });
      return true;
    }
    if (method === "PATCH") {
      const body = await parseBody(req, profileSchema, 10_000);
      const changingEmail = body.email !== undefined && body.email !== user.email.toLowerCase();
      if (changingEmail) {
        // Someone with a stolen session mustn't be able to guess the password here
        if (limited(req, res, "password-check", 10, user.id)) return true;
        const row = await account.findUserById(user.id);
        if (row && !row.password_hash) return fail(res, 403, "set_password_first"), true;
        if (!row || !body.currentPassword || !(await verifyPassword(row.password_hash, body.currentPassword))) return fail(res, 403, "wrong_password"), true;
      }
      const updated = await account.updateUser(user.id, { name: body.name, email: changingEmail ? body.email : undefined, locale: body.locale });
      if (!updated) return fail(res, 409, "email_taken"), true;
      send(res, 200, { ...publicUser(updated), memberSince: updated.created_at.toISOString(), ...(await signInMethods(user.id)) });
      return true;
    }
  }

  if (p === "/password" && method === "POST") {
    if (limited(req, res, "password-check", 10, user.id)) return true;
    const body = await parseBody(req, passwordChangeSchema, 10_000);
    const row = await account.findUserById(user.id);
    // Accounts from "Continue with Google" can set their first password without a current one
    if (!row || (row.password_hash && !(await verifyPassword(row.password_hash, body.currentPassword ?? "")))) return fail(res, 403, "wrong_password"), true;
    await account.setPassword(user.id, await hashPassword(body.newPassword));
    // Every other device has to sign in again with the new password
    await endAllSessions(user.id, user.sessionId);
    send(res, 200, { ok: true });
    return true;
  }

  /* ---- bag ---- */
  if (p === "/cart") {
    if (method === "GET") return send(res, 200, { items: await account.getCart(user.id) }), true;
    if (method === "PUT") {
      const body = await parseBody(req, cartSchema);
      send(res, 200, { items: await account.putCart(user.id, body.items, body.mode) });
      return true;
    }
  }

  /* ---- addresses ---- */
  if (p === "/addresses") {
    if (method === "GET") return send(res, 200, { addresses: await account.listAddresses(user.id) }), true;
    if (method === "POST") {
      const dedupe = new URL(req.url ?? "/", "http://x").searchParams.get("dedupe") === "1";
      try {
        const address = await account.createAddress(user.id, await parseBody(req, addressSchema, 10_000), { dedupe });
        send(res, 201, { address, addresses: await account.listAddresses(user.id) });
      } catch (err) {
        if (err instanceof account.AddressLimitError) return fail(res, 422, "too_many_addresses"), true;
        throw err;
      }
      return true;
    }
  }
  const addr = p.match(/^\/addresses\/([0-9a-f-]{36})(\/default)?$/i);
  if (addr) {
    const [, id, isDefault] = addr;
    if (isDefault && method === "POST") {
      if (!(await account.setDefaultAddress(user.id, id))) return fail(res, 404, "address_not_found"), true;
      return send(res, 200, { addresses: await account.listAddresses(user.id) }), true;
    }
    if (!isDefault && method === "PATCH") {
      const current = await account.getAddress(user.id, id);
      if (!current) return fail(res, 404, "address_not_found"), true;
      const patch = await parseBody(req, addressPatchSchema, 10_000);
      // Validate the merged result with the full rules
      const merged = addressSchema.safeParse({ ...current, ...patch, isDefault: patch.isDefault });
      if (!merged.success) return fail(res, 422, "validation"), true;
      const address = await account.updateAddress(user.id, id, merged.data);
      send(res, 200, { address, addresses: await account.listAddresses(user.id) });
      return true;
    }
    if (!isDefault && method === "DELETE") {
      if (!(await account.deleteAddress(user.id, id))) return fail(res, 404, "address_not_found"), true;
      return send(res, 200, { addresses: await account.listAddresses(user.id) }), true;
    }
  }

  /* ---- wishlist ---- */
  if (p === "/wishlist") {
    if (method === "GET") return send(res, 200, { ids: await account.getWishlist(user.id) }), true;
    if (method === "PUT") {
      const body = await parseBody(req, wishlistSchema);
      return send(res, 200, { ids: await account.putWishlist(user.id, body.ids, body.mode) }), true;
    }
    if (method === "DELETE") return send(res, 200, { ids: await account.removeFromWishlist(user.id) }), true;
  }
  const wish = p.match(/^\/wishlist\/([A-Za-z0-9-]{1,40})$/);
  if (wish && method === "DELETE") return send(res, 200, { ids: await account.removeFromWishlist(user.id, wish[1]) }), true;

  /* ---- orders & reviews ---- */
  if (p === "/orders" && method === "GET") return send(res, 200, { orders: await listOrders(user.id) }), true;
  const order = p.match(/^\/orders\/(VD-\d{6})$/);
  if (order && method === "GET") return await sendOrder(res, user, order[1]), true;
  if (p === "/reviews" && method === "GET") return send(res, 200, { reviews: await account.myReviews(user.id) }), true;

  return false;
}
