/**
 * A signed-in customer's own data: profile, addresses, bag, wishlist and reviews.
 * Every query is scoped to the customer's user id.
 */
import type { AddressInput } from "../../../src/lib/account-schema";
import type { Address } from "../../../src/types";
import { query, withTransaction } from "../../db/pool";

/* ------------------------------ users ------------------------------ */

export type UserRow = { id: string; email: string; name: string; locale: string; password_hash: string; created_at: Date; blocked_at: Date | null };

export async function findUserByEmail(email: string) {
  const { rows } = await query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const { rows } = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Returns the new user's id, or null when the email is already registered. */
export async function createUser(u: { email: string; name: string; locale: string; passwordHash: string }) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (email, name, locale, password_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [u.email, u.name, u.locale, u.passwordHash],
  );
  return rows[0]?.id ?? null;
}

/** null = email already used by another account */
export async function updateUser(id: string, patch: { name?: string; email?: string; locale?: string }) {
  try {
    const { rows } = await query<UserRow>(
      `UPDATE users SET name = coalesce($2, name), email = coalesce($3, email), locale = coalesce($4, locale)
        WHERE id = $1 RETURNING *`,
      [id, patch.name ?? null, patch.email ?? null, patch.locale ?? null],
    );
    return rows[0] ?? null;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return null;
    throw err;
  }
}

export async function setPassword(id: string, passwordHash: string) {
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
}

/* ------------------------------ addresses ------------------------------ */

export type AddressRow = {
  id: string;
  label: string;
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default: boolean;
};

export function addressFromRow(r: AddressRow): Address {
  return {
    id: r.id,
    label: r.label,
    fullName: r.full_name,
    line1: r.line1,
    ...(r.line2 ? { line2: r.line2 } : {}),
    city: r.city,
    region: r.region,
    postalCode: r.postal_code,
    country: r.country.trim(),
    phone: r.phone,
    isDefault: r.is_default,
  };
}

export async function listAddresses(userId: string): Promise<Address[]> {
  const { rows } = await query<AddressRow>("SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at", [userId]);
  return rows.map(addressFromRow);
}

const addressValues = (a: Omit<AddressInput, "isDefault">) => [a.label ?? "", a.fullName, a.line1, a.line2 ?? null, a.city, a.region, a.postalCode, a.country, a.phone];

/**
 * Adds an address. The first one becomes the default. With `dedupe`, an identical
 * address that's already saved is reused (merging a browser's address book on sign-in).
 */
export async function createAddress(userId: string, input: AddressInput, { dedupe = false } = {}): Promise<Address> {
  return withTransaction(async (client) => {
    if (dedupe) {
      const { rows } = await client.query<AddressRow>(
        `SELECT * FROM addresses
          WHERE user_id = $1 AND full_name = $3 AND line1 = $4 AND coalesce(line2, '') = coalesce($5, '')
            AND city = $6 AND region = $7 AND postal_code = $8 AND country = $9 AND phone = $10
          LIMIT 1`,
        [userId, ...addressValues(input)],
      );
      if (rows[0]) return addressFromRow(rows[0]);
    }
    const { rows: count } = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM addresses WHERE user_id = $1", [userId]);
    const makeDefault = !!input.isDefault || count[0].n === 0;
    if (makeDefault) await client.query("UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default", [userId]);
    const { rows } = await client.query<AddressRow>(
      `INSERT INTO addresses (user_id, label, full_name, line1, line2, city, region, postal_code, country, phone, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [userId, ...addressValues(input), makeDefault],
    );
    return addressFromRow(rows[0]);
  });
}

/** Returns null when the address isn't the customer's. */
export async function updateAddress(userId: string, id: string, input: AddressInput): Promise<Address | null> {
  return withTransaction(async (client) => {
    if (input.isDefault) await client.query("UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default AND id <> $2", [userId, id]);
    const { rows } = await client.query<AddressRow>(
      `UPDATE addresses SET label = $3, full_name = $4, line1 = $5, line2 = $6, city = $7, region = $8, postal_code = $9, country = $10, phone = $11,
              is_default = is_default OR $12
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, ...addressValues(input), !!input.isDefault],
    );
    return rows[0] ? addressFromRow(rows[0]) : null;
  });
}

export async function getAddress(userId: string, id: string): Promise<Address | null> {
  const { rows } = await query<AddressRow>("SELECT * FROM addresses WHERE id = $1 AND user_id = $2", [id, userId]);
  return rows[0] ? addressFromRow(rows[0]) : null;
}

/** Removing the default makes the oldest remaining address the default. */
export async function deleteAddress(userId: string, id: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ is_default: boolean }>("DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default", [id, userId]);
    if (!rows[0]) return false;
    if (rows[0].is_default) {
      await client.query(
        `UPDATE addresses SET is_default = true
          WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at LIMIT 1)`,
        [userId],
      );
    }
    return true;
  });
}

export async function setDefaultAddress(userId: string, id: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT 1 FROM addresses WHERE id = $1 AND user_id = $2", [id, userId]);
    if (!rows[0]) return false;
    await client.query("UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default", [userId]);
    await client.query("UPDATE addresses SET is_default = true WHERE id = $1", [id]);
    return true;
  });
}

/* ------------------------------ bag ------------------------------ */

export type CartLine = { productId: string; size?: string; colour?: string; quantity: number };

export async function getCart(userId: string): Promise<CartLine[]> {
  const { rows } = await query<{ product_id: string; size: string; colour: string; quantity: number }>(
    `SELECT c.product_id, c.size, c.colour, c.quantity
       FROM cart_items c JOIN products p ON p.id = c.product_id AND p.deleted_at IS NULL AND NOT p.hidden
      WHERE c.user_id = $1 ORDER BY c.created_at, c.product_id`,
    [userId],
  );
  return rows.map((r) => ({ productId: r.product_id, size: r.size || undefined, colour: r.colour || undefined, quantity: r.quantity }));
}

/**
 * replace: the bag becomes exactly `items` (the browser saves its bag).
 * merge: `items` are added to what's there (a signed-out bag joining the account on sign-in).
 * Lines for products that no longer exist are skipped; each line is capped at 10.
 */
export async function putCart(userId: string, items: CartLine[], mode: "replace" | "merge"): Promise<CartLine[]> {
  const lines = new Map<string, CartLine>();
  for (const i of items) {
    const key = [i.productId, i.size ?? "", i.colour ?? ""].join("|");
    const prev = lines.get(key);
    lines.set(key, { ...i, quantity: Math.min(10, (prev?.quantity ?? 0) + i.quantity) });
  }
  const list = [...lines.values()];
  await withTransaction(async (client) => {
    if (mode === "replace") await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);
    if (!list.length) return;
    await client.query(
      `INSERT INTO cart_items (user_id, product_id, size, colour, quantity)
       SELECT $1, t.product_id, t.size, t.colour, t.quantity
         FROM unnest($2::text[], $3::text[], $4::text[], $5::int[]) AS t(product_id, size, colour, quantity)
         JOIN products p ON p.id = t.product_id AND p.deleted_at IS NULL
       ON CONFLICT (user_id, product_id, size, colour)
       DO UPDATE SET quantity = least(10, cart_items.quantity + EXCLUDED.quantity)`,
      [userId, list.map((l) => l.productId), list.map((l) => l.size ?? ""), list.map((l) => l.colour ?? ""), list.map((l) => l.quantity)],
    );
  });
  return getCart(userId);
}

/* ------------------------------ wishlist ------------------------------ */

export async function getWishlist(userId: string): Promise<string[]> {
  const { rows } = await query<{ product_id: string }>(
    `SELECT w.product_id FROM wishlist_items w JOIN products p ON p.id = w.product_id AND p.deleted_at IS NULL AND NOT p.hidden
      WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
    [userId],
  );
  return rows.map((r) => r.product_id);
}

/** ids are newest first (as the browser keeps them). */
export async function putWishlist(userId: string, ids: string[], mode: "replace" | "merge"): Promise<string[]> {
  await withTransaction(async (client) => {
    if (mode === "replace") await client.query("DELETE FROM wishlist_items WHERE user_id = $1 AND NOT (product_id = ANY($2::text[]))", [userId, ids]);
    // Oldest gets the earliest timestamp so the order survives
    const reversed = [...new Set(ids)].reverse();
    await client.query(
      `INSERT INTO wishlist_items (user_id, product_id, created_at)
       SELECT $1, t.id, now() + (t.n * interval '1 millisecond')
         FROM unnest($2::text[]) WITH ORDINALITY AS t(id, n)
         JOIN products p ON p.id = t.id AND p.deleted_at IS NULL
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, reversed],
    );
  });
  return getWishlist(userId);
}

export async function removeFromWishlist(userId: string, productId?: string) {
  if (productId) await query("DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2", [userId, productId]);
  else await query("DELETE FROM wishlist_items WHERE user_id = $1", [userId]);
  return getWishlist(userId);
}

/* ------------------------------ reviews ------------------------------ */

export async function myReviews(userId: string) {
  const { rows } = await query<{ id: string; product_id: string }>("SELECT id, product_id FROM reviews WHERE user_id = $1", [userId]);
  return rows.map((r) => ({ id: r.id, productId: r.product_id }));
}

export class ReviewError extends Error {
  constructor(public code: "not_found" | "already_reviewed") {
    super(code);
  }
}

/** "Verified buyer" (and what they bought) when the customer has a non-cancelled order with this product. */
export async function createReview(user: { id: string; name: string }, productId: string, r: { rating: number; title: string; body: string; author?: string }) {
  const { rows: product } = await query("SELECT 1 FROM products WHERE id = $1 AND deleted_at IS NULL AND NOT hidden", [productId]);
  if (!product[0]) throw new ReviewError("not_found");
  const { rows: bought } = await query<{ size: string; colour: string }>(
    `SELECT i.size, i.colour FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.user_id = $1 AND i.product_id = $2 AND o.status <> 'cancelled'
      ORDER BY o.created_at DESC LIMIT 1`,
    [user.id, productId],
  );
  const b = bought[0];
  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO reviews (product_id, user_id, author, rating, title, body, size_bought, colour_bought, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [productId, user.id, r.author || user.name, r.rating, r.title, r.body, b?.size || null, b?.colour || null, !!b],
    );
    return { id: rows[0].id, productId };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new ReviewError("already_reviewed");
    throw err;
  }
}
