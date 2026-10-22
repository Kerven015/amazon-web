/**
 * Admin → Reviews: every review (newest first), hide / show, delete.
 * Hidden reviews stay in the database but aren't shown in the shop or counted in the
 * product's rating (products.ts leaves them out). Writing reviews is in account.ts.
 */
import { query } from "../../db/pool";
import type { L10n } from "../../../src/types";

export type AdminReview = {
  id: string;
  productId: string;
  productTitle: L10n | null;
  author: string;
  /** Customer account email (null for imported catalogue reviews or deleted accounts) */
  email: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  hidden: boolean;
  createdAt: string;
};

export type ReviewFilter = { q?: string; status?: "all" | "visible" | "hidden"; rating?: number; limit?: number };

export async function listReviews(f: ReviewFilter = {}): Promise<AdminReview[]> {
  const q = f.q?.trim() ? `%${f.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const { rows } = await query<{
    id: string;
    product_id: string;
    product_title: L10n | null;
    author: string;
    email: string | null;
    rating: number;
    title: string;
    body: string;
    verified: boolean;
    hidden_at: Date | null;
    created_at: Date;
  }>(
    `SELECT r.id, r.product_id, p.data->'title' AS product_title, r.author, u.email::text AS email, r.rating, r.title, r.body,
            r.verified, r.hidden_at, r.created_at
       FROM reviews r
       JOIN products p ON p.id = r.product_id AND p.deleted_at IS NULL
       LEFT JOIN users u ON u.id = r.user_id
      WHERE ($1::text IS NULL OR r.title ILIKE $1 OR r.body ILIKE $1 OR r.author ILIKE $1 OR p.data->'title'->>'en' ILIKE $1)
        AND ($2 = 'all' OR ($2 = 'hidden') = (r.hidden_at IS NOT NULL))
        AND ($3::int IS NULL OR r.rating = $3)
      ORDER BY r.created_at DESC, r.id
      LIMIT $4`,
    [q, f.status ?? "all", f.rating ?? null, Math.min(Math.max(f.limit ?? 500, 1), 1000)],
  );
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productTitle: r.product_title,
    author: r.author,
    email: r.email,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.verified,
    hidden: !!r.hidden_at,
    createdAt: r.created_at.toISOString(),
  }));
}

/** Returns the product id, or null when there's no such review. */
export async function setReviewHidden(id: string, hidden: boolean): Promise<string | null> {
  const { rows } = await query<{ product_id: string }>(
    `UPDATE reviews SET hidden_at = CASE WHEN $2 THEN coalesce(hidden_at, now()) ELSE NULL END WHERE id = $1 RETURNING product_id`,
    [id, hidden],
  );
  return rows[0]?.product_id ?? null;
}

/** Deletes for good. Returns what was removed (for the activity log), or null. */
export async function deleteReview(id: string): Promise<{ productId: string; rating: number; author: string } | null> {
  const { rows } = await query<{ product_id: string; rating: number; author: string }>("DELETE FROM reviews WHERE id = $1 RETURNING product_id, rating, author", [id]);
  return rows[0] ? { productId: rows[0].product_id, rating: rows[0].rating, author: rows[0].author } : null;
}
