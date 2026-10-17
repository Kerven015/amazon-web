/**
 * Customer accounts (separate from the admin login in server/auth.ts).
 *
 * - Passwords: Argon2id (@node-rs/argon2). Plain passwords are never stored or logged.
 * - Sessions: a random 32-byte token in the httpOnly `vendora_session` cookie; the database
 *   keeps only its SHA-256 hash, so a leaked sessions table can't be used to sign in.
 *   "Keep me signed in" → 30 days; otherwise a browser-session cookie that the server
 *   also expires after 1 day. The expiry slides forward on use, at most once an hour.
 * - Sign-in rate limit: 5 failures per IP + email in 15 minutes (login_attempts table).
 */
import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { hash, verify } from "@node-rs/argon2";
import { clientIp, readCookie } from "./auth";
import { type Db, query } from "./db/pool";
import { env, isProduction } from "./env";

export const SESSION_COOKIE = "vendora_session";
const DAY_MS = 24 * 60 * 60 * 1000;
const REMEMBER_MS = 30 * DAY_MS;
const SHORT_MS = DAY_MS;
const SLIDE_EVERY_MS = 60 * 60 * 1000;
export const MAX_LOGIN_FAILS = 5;
const FAIL_WINDOW_MIN = 15;

/* ------------------------------ passwords ------------------------------ */

// OWASP's Argon2id baseline (19 MiB, 2 iterations, 1 lane)
const ARGON = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, ARGON);

export async function verifyPassword(stored: string, password: string) {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** Verifying against this when the email is unknown makes both cases take the same time. */
let dummyHash: Promise<string> | null = null;
export const timingDummy = () => (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));

/* ------------------------------ sessions ------------------------------ */

export type SessionUser = { id: string; name: string; email: string; locale: string; createdAt: string; sessionId: string };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function isHttps(req: IncomingMessage) {
  return (req.socket as { encrypted?: boolean }).encrypted || req.headers["x-forwarded-proto"] === "https";
}

/** Secure in production (and on https); left off on http://localhost so Safari keeps the cookie. */
function cookieAttrs(req: IncomingMessage) {
  const secure = isProduction() || isHttps(req) || env("COOKIE_SECURE") === "1";
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Adds a Set-Cookie header without dropping one that's already there. */
function appendCookie(res: ServerResponse, cookie: string) {
  const prev = res.getHeader("Set-Cookie");
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  res.setHeader("Set-Cookie", [...list, cookie]);
}

function setCookie(req: IncomingMessage, res: ServerResponse, token: string, remember: boolean) {
  // Without "Keep me signed in" there's no Max-Age: the browser drops the cookie when it closes
  appendCookie(res, `${SESSION_COOKIE}=${token}${remember ? `; Max-Age=${REMEMBER_MS / 1000}` : ""}; ${cookieAttrs(req)}`);
}

export function clearCustomerCookie(req: IncomingMessage, res: ServerResponse) {
  appendCookie(res, `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`);
}

/** Creates a session row and sets the cookie. */
export async function startSession(req: IncomingMessage, res: ServerResponse, userId: string, remember: boolean, db: Db = { query }) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (id, user_id, remember, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4), $5, $6)`,
    [tokenHash(token), userId, remember, (remember ? REMEMBER_MS : SHORT_MS) / 1000, String(req.headers["user-agent"] ?? "").slice(0, 300), clientIp(req)],
  );
  setCookie(req, res, token, remember);
  // Now and then, clear out expired sessions and old sign-in failures
  if (Math.random() < 0.05) {
    void query("DELETE FROM sessions WHERE expires_at < now()").catch(() => {});
    void query("DELETE FROM login_attempts WHERE at < now() - interval '1 day'").catch(() => {});
  }
}

/**
 * The signed-in customer for this request, or null.
 * Slides the expiry forward (and refreshes a "remember me" cookie) at most once an hour.
 */
export async function customerFrom(req: IncomingMessage, res?: ServerResponse): Promise<SessionUser | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const id = tokenHash(token);
  const { rows } = await query<{ id: string; name: string; email: string; locale: string; created_at: Date; remember: boolean; last_seen_at: Date }>(
    `SELECT u.id, u.name, u.email, u.locale, u.created_at, s.remember, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - row.last_seen_at.getTime() > SLIDE_EVERY_MS) {
    await query("UPDATE sessions SET last_seen_at = now(), expires_at = now() + make_interval(secs => $2) WHERE id = $1", [
      id,
      (row.remember ? REMEMBER_MS : SHORT_MS) / 1000,
    ]);
    if (row.remember && res) setCookie(req, res, token, true);
  }
  return { id: row.id, name: row.name, email: row.email, locale: row.locale, createdAt: row.created_at.toISOString(), sessionId: id };
}

export async function endSession(req: IncomingMessage, res: ServerResponse) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await query("DELETE FROM sessions WHERE id = $1", [tokenHash(token)]);
  clearCustomerCookie(req, res);
}

/** Signs the customer out everywhere — optionally keeping the current session. */
export async function endAllSessions(userId: string, keepSessionId?: string, db: Db = { query }) {
  if (keepSessionId) await db.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, keepSessionId]);
  else await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

/* ------------------------------ rate limit ------------------------------ */

export async function tooManyFailures(ip: string, email: string) {
  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1 AND email = $2 AND at > now() - make_interval(mins => $3)`,
    [ip, email, FAIL_WINDOW_MIN],
  );
  return rows[0].n >= MAX_LOGIN_FAILS;
}

export async function recordLoginFailure(ip: string, email: string) {
  await query("INSERT INTO login_attempts (ip, email) VALUES ($1, $2)", [ip, email]);
}

export async function clearLoginFailures(ip: string, email: string) {
  await query("DELETE FROM login_attempts WHERE ip = $1 AND email = $2", [ip, email]);
}
