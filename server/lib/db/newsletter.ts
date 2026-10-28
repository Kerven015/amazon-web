/**
 * Newsletter sign-ups (newsletter_subscribers, 008_newsletter.sql).
 *
 * - Signing up stores the email, language, time, IP and the exact consent sentence shown
 *   (in that language), so there's a record of what each person agreed to.
 * - Every subscriber has an unsubscribe link: /newsletter/unsubscribe?token=<id>.<signature>.
 *   The signature is an HMAC of the id with ADMIN_SESSION_SECRET, so links can be rebuilt for
 *   every export without storing tokens (changing that secret makes old links stop working).
 * - Unsubscribing keeps the row (unsubscribed_at) so a later export never includes them;
 *   the admin can delete a subscriber for good.
 * - The shop doesn't send email itself: the admin exports the list (with unsubscribe links)
 *   to an email service.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import tk from "../../../messages/tk.json";
import tr from "../../../messages/tr.json";
import { formatMessage } from "../../../src/i18n/icu";
import type { Locale } from "../../../src/i18n/config";
import { siteConfig } from "../../../src/lib/config";
import { query } from "../../db/pool";
import { env } from "../../env";

const MESSAGES = { en, tr, tk, ru } as const;

/** The consent sentence the form shows, in the visitor's language (stored as proof). */
export function consentText(locale: Locale) {
  const m = MESSAGES[locale].newsletter;
  return `${formatMessage(m.consent, { store: siteConfig.name }, locale)} ${m.privacy}.`;
}

/* ------------------------------ unsubscribe links ------------------------------ */

function secret() {
  const s = env("ADMIN_SESSION_SECRET");
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET is needed to sign newsletter unsubscribe links");
  return s;
}
const sign = (id: string) => createHmac("sha256", secret()).update(`newsletter-unsubscribe:${id}`).digest("base64url");

export const unsubscribeToken = (id: string) => `${id}.${sign(id)}`;

/** The subscriber id in a valid token, or null. */
export function verifyUnsubscribeToken(token: string): string | null {
  const m = token.match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i);
  if (!m) return null;
  const expected = Buffer.from(sign(m[1]));
  const given = Buffer.from(m[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? m[1] : null;
}

/* ------------------------------ shop ------------------------------ */

/**
 * Adds (or re-adds) an email. Same result whether or not it was already on the list, so the
 * form can't be used to find out who is subscribed.
 */
export async function subscribe(s: { email: string; locale: Locale; userId: string | null; ip: string }) {
  await query(
    `INSERT INTO newsletter_subscribers (email, locale, user_id, consent_text, ip)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET
       locale = EXCLUDED.locale,
       user_id = coalesce(EXCLUDED.user_id, newsletter_subscribers.user_id),
       -- Signing up again after unsubscribing is a new consent
       subscribed_at = CASE WHEN newsletter_subscribers.unsubscribed_at IS NULL THEN newsletter_subscribers.subscribed_at ELSE now() END,
       consent_text = EXCLUDED.consent_text,
       ip = EXCLUDED.ip,
       unsubscribed_at = NULL`,
    [s.email.trim(), s.locale, s.userId, consentText(s.locale), s.ip],
  );
}

/** Returns false when the link isn't valid (or the subscriber was deleted). */
export async function unsubscribe(token: string): Promise<boolean> {
  const id = verifyUnsubscribeToken(token);
  if (!id) return false;
  const { rowCount } = await query("UPDATE newsletter_subscribers SET unsubscribed_at = coalesce(unsubscribed_at, now()) WHERE id = $1", [id]);
  return rowCount === 1;
}

/* ------------------------------ admin ------------------------------ */

export type Subscriber = { id: string; email: string; locale: string; customer: boolean; subscribedAt: string; unsubscribedAt: string | null };

type Row = { id: string; email: string; locale: string; user_id: string | null; subscribed_at: Date; unsubscribed_at: Date | null };

export async function listSubscribers({ q, status = "subscribed" }: { q?: string; status?: "subscribed" | "unsubscribed" | "all" } = {}) {
  const pattern = q?.trim() ? `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const [list, counts] = await Promise.all([
    query<Row>(
      `SELECT id, email::text AS email, locale, user_id, subscribed_at, unsubscribed_at FROM newsletter_subscribers
        WHERE ($1::text IS NULL OR email::text ILIKE $1)
          AND ($2 = 'all' OR ($2 = 'unsubscribed') = (unsubscribed_at IS NOT NULL))
        ORDER BY subscribed_at DESC LIMIT 1000`,
      [pattern, status],
    ),
    query<{ subscribed: number; unsubscribed: number }>(
      "SELECT count(*) FILTER (WHERE unsubscribed_at IS NULL)::int AS subscribed, count(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed FROM newsletter_subscribers",
    ),
  ]);
  return {
    counts: counts.rows[0],
    subscribers: list.rows.map(
      (r): Subscriber => ({
        id: r.id,
        email: r.email,
        locale: r.locale,
        customer: !!r.user_id,
        subscribedAt: r.subscribed_at.toISOString(),
        unsubscribedAt: r.unsubscribed_at?.toISOString() ?? null,
      }),
    ),
  };
}

/** Everyone still subscribed, with their personal unsubscribe link (for the email service). */
export async function exportSubscribers(origin: string) {
  const { rows } = await query<Row>(
    "SELECT id, email::text AS email, locale, user_id, subscribed_at, unsubscribed_at FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY subscribed_at",
  );
  return rows.map((r) => ({ email: r.email, locale: r.locale, subscribedAt: r.subscribed_at.toISOString(), unsubscribeUrl: `${origin}/${r.locale}/newsletter/unsubscribe?token=${unsubscribeToken(r.id)}` }));
}

/** Deletes for good; returns the email (for the activity log) or null. */
export async function deleteSubscriber(id: string): Promise<string | null> {
  const { rows } = await query<{ email: string }>("DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING email::text AS email", [id]);
  return rows[0]?.email ?? null;
}
