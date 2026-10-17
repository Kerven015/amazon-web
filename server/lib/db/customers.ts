/**
 * Admin → Customers: every customer account, who is signed in (and on which
 * devices), and the admin's actions: sign out, block / unblock, delete.
 * Password hashes never leave this file.
 */
import { query, withTransaction } from "../../db/pool";

/** "Active now" = used the site in the last 10 minutes */
export const ACTIVE_MINUTES = 10;

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  locale: string;
  createdAt: string;
  blocked: boolean;
  /** Devices currently signed in */
  sessions: number;
  lastSeen: string | null;
  activeNow: boolean;
  orders: number;
  spent: number;
};

export type AdminSession = { id: string; createdAt: string; lastSeen: string; expiresAt: string; remember: boolean; userAgent: string; ip: string; activeNow: boolean };

export type AdminCustomerDetail = AdminCustomer & {
  addresses: number;
  reviews: number;
  sessionList: AdminSession[];
  recentOrders: { id: string; status: string; total: number; createdAt: string }[];
};

type Row = {
  id: string;
  name: string;
  email: string;
  locale: string;
  created_at: Date;
  blocked_at: Date | null;
  sessions: number;
  last_seen: Date | null;
  orders: number;
  spent: number;
};

const SELECT = `
  SELECT u.id, u.name, u.email, u.locale, u.created_at, u.blocked_at,
         (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now())::int AS sessions,
         (SELECT max(s.last_seen_at) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS last_seen,
         (SELECT count(*) FROM orders o WHERE o.user_id = u.id)::int AS orders,
         (SELECT coalesce(sum(o.total), 0) FROM orders o WHERE o.user_id = u.id AND o.status <> 'cancelled') AS spent
    FROM users u`;

const isActive = (seen: Date | null) => !!seen && Date.now() - seen.getTime() < ACTIVE_MINUTES * 60_000;

function toCustomer(r: Row): AdminCustomer {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    locale: r.locale,
    createdAt: r.created_at.toISOString(),
    blocked: !!r.blocked_at,
    sessions: r.blocked_at ? 0 : r.sessions,
    lastSeen: r.last_seen?.toISOString() ?? null,
    activeNow: !r.blocked_at && isActive(r.last_seen),
    orders: r.orders,
    spent: r.spent,
  };
}

/** Everyone, most recently active first. `search` matches name or email. */
export async function listCustomers(search = ""): Promise<AdminCustomer[]> {
  const q = search.trim().slice(0, 100);
  // Search text is a parameter; % and _ are escaped so they match literally
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { rows } = await query<Row>(
    `${SELECT}
      WHERE $1 = '' OR u.name ILIKE $2 OR u.email::text ILIKE $2
      ORDER BY last_seen DESC NULLS LAST, u.created_at DESC
      LIMIT 1000`,
    [q, pattern],
  );
  return rows.map(toCustomer);
}

export async function getCustomer(id: string): Promise<AdminCustomerDetail | null> {
  const { rows } = await query<Row>(`${SELECT} WHERE u.id = $1`, [id]);
  if (!rows[0]) return null;
  const [sessions, orders, counts] = await Promise.all([
    query<{ id: string; created_at: Date; last_seen_at: Date; expires_at: Date; remember: boolean; user_agent: string | null; ip: string | null }>(
      "SELECT id, created_at, last_seen_at, expires_at, remember, user_agent, ip FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC",
      [id],
    ),
    query<{ id: string; status: string; total: number; created_at: Date }>("SELECT id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10", [id]),
    query<{ addresses: number; reviews: number }>(
      "SELECT (SELECT count(*) FROM addresses WHERE user_id = $1)::int AS addresses, (SELECT count(*) FROM reviews WHERE user_id = $1)::int AS reviews",
      [id],
    ),
  ]);
  return {
    ...toCustomer(rows[0]),
    addresses: counts.rows[0].addresses,
    reviews: counts.rows[0].reviews,
    sessionList: rows[0].blocked_at
      ? []
      : sessions.rows.map((s) => ({
          // The stored id is already a hash of the cookie token, so it can't be used to sign in
          id: s.id,
          createdAt: s.created_at.toISOString(),
          lastSeen: s.last_seen_at.toISOString(),
          expiresAt: s.expires_at.toISOString(),
          remember: s.remember,
          userAgent: s.user_agent ?? "",
          ip: s.ip ?? "",
          activeNow: isActive(s.last_seen_at),
        })),
    recentOrders: orders.rows.map((o) => ({ id: o.id, status: o.status, total: o.total, createdAt: o.created_at.toISOString() })),
  };
}

/** Signs the customer out on every device. Returns how many sessions ended. */
export async function signOutCustomer(id: string) {
  const { rowCount } = await query("DELETE FROM sessions WHERE user_id = $1", [id]);
  return rowCount ?? 0;
}

/** Ends one device's session. */
export async function endCustomerSession(userId: string, sessionId: string) {
  const { rowCount } = await query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [sessionId, userId]);
  return rowCount === 1;
}

/** Blocking also signs the customer out everywhere. Returns false when there's no such customer. */
export async function setBlocked(id: string, blocked: boolean) {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE users SET blocked_at = CASE WHEN $2 THEN coalesce(blocked_at, now()) ELSE NULL END WHERE id = $1`,
      [id, blocked],
    );
    if (rowCount !== 1) return false;
    if (blocked) await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    return true;
  });
}

/**
 * Deletes an account with everything that belongs to it (sessions, addresses, bag,
 * wishlist; reviews stay, without the link to the account). Customers with orders
 * can't be deleted — the orders must stay for the shop's records; block them instead.
 */
export async function deleteCustomer(id: string): Promise<"deleted" | "not_found" | "has_orders"> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ orders: number }>(
      "SELECT (SELECT count(*) FROM orders WHERE user_id = u.id)::int AS orders FROM users u WHERE u.id = $1 FOR UPDATE",
      [id],
    );
    if (!rows[0]) return "not_found";
    if (rows[0].orders > 0) return "has_orders";
    await client.query("DELETE FROM users WHERE id = $1", [id]);
    return "deleted";
  });
}
