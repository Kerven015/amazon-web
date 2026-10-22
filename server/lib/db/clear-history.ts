/**
 * "Clear history" in the admin sections. Each one deletes rows from the database for good:
 *
 *   orders      delivered and cancelled orders (with their items and tracking events).
 *               Orders still being processed are never touched. Removed orders also
 *               leave the dashboard, the reports and the customer's order history.
 *   inventory   the stock history (stock_movements). Current stock is not changed.
 *   reviews     reviews the admin hid. Shown reviews stay.
 *   customers   expired sign-in sessions and failed sign-in attempts older than a day
 *               (newer ones are still needed by the sign-in rate limit). Accounts stay.
 *   activity    the activity log, through clear_admin_audit_log(), which always leaves
 *               one entry saying who cleared it and how many entries were removed.
 */
import { query, withTransaction } from "../../db/pool";

export const CLEARABLE = ["orders", "inventory", "reviews", "customers", "activity"] as const;
export type Clearable = (typeof CLEARABLE)[number];

/** How many rows "Clear history" would remove right now (shown in the confirmation). */
export async function clearPreview(what: Clearable): Promise<number> {
  const sql: Record<Clearable, string> = {
    orders: "SELECT count(*)::int AS n FROM orders WHERE status IN ('delivered', 'cancelled')",
    inventory: "SELECT count(*)::int AS n FROM stock_movements",
    reviews: "SELECT count(*)::int AS n FROM reviews WHERE hidden_at IS NOT NULL",
    customers: `SELECT ((SELECT count(*) FROM sessions WHERE expires_at <= now())
                      + (SELECT count(*) FROM login_attempts WHERE at < now() - interval '1 day'))::int AS n`,
    activity: "SELECT count(*)::int AS n FROM admin_audit_log",
  };
  const { rows } = await query<{ n: number }>(sql[what]);
  return rows[0].n;
}

/** Deletes the section's history; returns how many rows were removed. */
export async function clearHistory(what: Clearable, actor: string, ip: string | null): Promise<number> {
  switch (what) {
    case "orders":
      // order_items and order_events go with them (ON DELETE CASCADE)
      return (await query("DELETE FROM orders WHERE status IN ('delivered', 'cancelled')")).rowCount ?? 0;
    case "inventory":
      return (await query("DELETE FROM stock_movements")).rowCount ?? 0;
    case "reviews":
      return (await query("DELETE FROM reviews WHERE hidden_at IS NOT NULL")).rowCount ?? 0;
    case "customers":
      return withTransaction(async (client) => {
        const sessions = (await client.query("DELETE FROM sessions WHERE expires_at <= now()")).rowCount ?? 0;
        const attempts = (await client.query("DELETE FROM login_attempts WHERE at < now() - interval '1 day'")).rowCount ?? 0;
        return sessions + attempts;
      });
    case "activity": {
      const { rows } = await query<{ n: number }>("SELECT clear_admin_audit_log($1, $2) AS n", [actor, ip]);
      return rows[0].n;
    }
  }
}
