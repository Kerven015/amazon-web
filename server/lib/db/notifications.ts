/**
 * Admin notifications: what's new in each section since the admin last opened it
 * (admin_seen, 006_admin_notifications.sql). Shown as badges on the "Manage" menu.
 *
 *   orders     orders placed since
 *   reviews    reviews written since
 *   customers  accounts created since
 *   inventory  sizes/colours that went low or out of stock since (and still are)
 */
import { query } from "../../db/pool";
import { getSettings } from "./settings";

export const SECTIONS = ["orders", "reviews", "customers", "inventory"] as const;
export type Section = (typeof SECTIONS)[number];
export type Notifications = Record<Section, number>;

export async function getNotifications(username: string): Promise<Notifications> {
  // The first time, start counting from now (rather than flagging everything that already exists)
  await query(
    `INSERT INTO admin_seen (username, section) SELECT $1, s FROM unnest($2::text[]) AS s ON CONFLICT DO NOTHING`,
    [username, [...SECTIONS]],
  );
  const { lowStockThreshold } = await getSettings();
  const { rows } = await query<Notifications>(
    `WITH seen AS (SELECT section, seen_at FROM admin_seen WHERE username = $1)
     SELECT
       (SELECT count(*) FROM orders WHERE created_at > (SELECT seen_at FROM seen WHERE section = 'orders'))::int AS orders,
       (SELECT count(*) FROM reviews WHERE created_at > (SELECT seen_at FROM seen WHERE section = 'reviews'))::int AS reviews,
       (SELECT count(*) FROM users WHERE created_at > (SELECT seen_at FROM seen WHERE section = 'customers'))::int AS customers,
       (SELECT count(*) FROM (
          SELECT DISTINCT m.product_id, m.size, m.colour
            FROM stock_movements m
            JOIN product_stock s ON s.product_id = m.product_id AND s.size = m.size AND s.colour = m.colour
            JOIN products p ON p.id = m.product_id AND p.deleted_at IS NULL
           WHERE m.created_at > (SELECT seen_at FROM seen WHERE section = 'inventory')
             AND m.change < 0 AND m.quantity_after <= $2 AND s.quantity <= $2
        ) x)::int AS inventory`,
    [username, lowStockThreshold],
  );
  return rows[0];
}

/** The admin opened a section: its count starts again from zero. */
export async function markSeen(username: string, section: Section) {
  await query(
    `INSERT INTO admin_seen (username, section, seen_at) VALUES ($1, $2, now())
     ON CONFLICT (username, section) DO UPDATE SET seen_at = now()`,
    [username, section],
  );
}
