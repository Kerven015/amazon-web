/**
 * Admin authentication.
 * - Credentials come from .env.local (ADMIN_USERNAME / ADMIN_PASSWORD) and are
 *   compared in constant time. In production the server refuses to start with a weak
 *   admin password (assertAdminConfig).
 * - Sessions: an HS256-signed JWT (ADMIN_SESSION_SECRET) in an httpOnly, SameSite=Strict
 *   cookie that expires after 8 hours. It carries a random session id that must also exist
 *   in the admin_sessions table, so logging out (or "log out everywhere") really ends it,
 *   and changing ADMIN_PASSWORD ends every admin session.
 * - Lockout: 5 failures from one IP lock that IP for 5 minutes; 50 failures from all IPs
 *   together within 15 minutes lock admin sign-in for 15 minutes (stops spread-out guessing).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { query } from "./db/pool";
import { env, isProduction } from "./env";

export const COOKIE = "vendora_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
const GLOBAL_MAX_FAILS = 50;
const GLOBAL_WINDOW_MS = 15 * 60 * 1000;
export const MIN_ADMIN_PASSWORD = 16;

/* ------------------------------ config ------------------------------ */

/**
 * The strict admin rules apply in production, and also to a dev server opened to other
 * devices or tunnels (DEV_EXPOSE / Codespaces — vite.config.ts sets VENDORA_EXPOSED),
 * because anyone with the link can reach its admin login.
 */
export const strictAdmin = () => isProduction() || env("VENDORA_EXPOSED") === "1";

export function authConfig() {
  const username = env("ADMIN_USERNAME");
  const password = env("ADMIN_PASSWORD");
  const secret = env("ADMIN_SESSION_SECRET");
  if (!username || !password || !secret || secret.length < 32) return null;
  // Production (or an exposed dev server) never runs with a weak admin password; the server also refuses to start
  if (strictAdmin() && adminConfigProblems().length) return null;
  return { username, password, secret };
}

/** Placeholders and passwords that are always guessed first. */
const WEAK = new Set(["change-me", "changeme", "password", "admin", "admin123", "admin2026", "administrator", "letmein", "qwerty", "vendora", "123456", "12345678"]);

/** Why the admin settings are unsafe (empty list = fine). Never includes the values themselves. */
export function adminConfigProblems(): string[] {
  const username = env("ADMIN_USERNAME") ?? "";
  const password = env("ADMIN_PASSWORD") ?? "";
  const secret = env("ADMIN_SESSION_SECRET") ?? "";
  const problems: string[] = [];
  if (!username || !password || !secret) return ["ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET must all be set"];
  if (password.length < MIN_ADMIN_PASSWORD) problems.push(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD} characters`);
  const lower = password.toLowerCase();
  if (WEAK.has(lower) || lower.includes("change-me") || lower.includes("changeme") || lower === username.toLowerCase())
    problems.push("ADMIN_PASSWORD is a placeholder or easy to guess (or the same as the username)");
  if (new Set(password).size < 6) problems.push("ADMIN_PASSWORD uses too few different characters");
  if (secret.length < 32) problems.push("ADMIN_SESSION_SECRET must be at least 32 random characters");
  if (secret === password) problems.push("ADMIN_SESSION_SECRET must not be the same as ADMIN_PASSWORD");
  return problems;
}

/**
 * Start-up check. Production, or a dev server exposed with DEV_EXPOSE: a weak or half-set admin
 * login stops the server. Local development: a warning only, so `npm run dev` still works with a
 * simple local password.
 * (No admin variables at all = admin login switched off, which is allowed.)
 */
export function assertAdminConfig() {
  const anySet = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"].some((k) => env(k));
  if (!anySet) {
    console.warn("[admin] ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_SECRET aren't set — the admin panel is switched off.");
    return;
  }
  const problems = adminConfigProblems();
  if (!problems.length) return;
  const list = problems.map((p) => `  - ${p}`).join("\n");
  if (strictAdmin()) {
    const where = isProduction() ? "for production" : "while the dev server is open to other devices (DEV_EXPOSE)";
    console.error(`\n✗ Can't start Vendora: the admin login isn't safe ${where}.\n${list}\n  Fix it in .env.local (a long random password: node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))").\n`);
    process.exit(1);
  }
  console.warn(`\n! Admin login: fine for development, but production would refuse to start:\n${list}\n`);
}

/* ------------------------- constant-time compare ------------------------- */

/** Hash first so both buffers have equal length; then compare in constant time. */
export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCredentials(username: string, password: string) {
  const cfg = authConfig();
  if (!cfg) return false;
  // Evaluate both so timing doesn't reveal which one was wrong
  const u = safeEqual(username, cfg.username);
  const p = safeEqual(password, cfg.password);
  return u && p;
}

/* --------------------------------- JWT --------------------------------- */

const b64 = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Changes whenever ADMIN_PASSWORD changes, so a new password ends every existing admin session. */
const passwordVersion = (cfg: { password: string; secret: string }) => createHmac("sha256", cfg.secret).update(`pw:${cfg.password}`).digest("base64url").slice(0, 16);

export function signSession(username: string, sid: string, now = Date.now()) {
  const cfg = authConfig();
  if (!cfg) throw new Error("Admin auth is not configured");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const iat = Math.floor(now / 1000);
  const payload = b64(JSON.stringify({ sub: username, role: "admin", sid, pwv: passwordVersion(cfg), iat, exp: iat + SESSION_SECONDS }));
  const sig = createHmac("sha256", cfg.secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

/** Checks the signature, expiry and password version (not yet whether the session was ended). */
export function verifySession(token: string | undefined, now = Date.now()): { sub: string; exp: number; sid: string } | null {
  const cfg = authConfig();
  if (!cfg || !token || token.length > 2000) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = createHmac("sha256", cfg.secret).update(`${header}.${payload}`).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, "base64url").toString());
    if (h.alg !== "HS256") return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.role !== "admin" || typeof data.exp !== "number" || data.exp * 1000 <= now) return null;
    if (typeof data.sid !== "string" || data.sid.length < 20 || data.pwv !== passwordVersion(cfg)) return null;
    return { sub: String(data.sub), exp: data.exp, sid: data.sid };
  } catch {
    return null;
  }
}

/* -------------------------------- cookies -------------------------------- */

export function readCookie(req: IncomingMessage, name = COOKIE) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== name) continue;
    // A malformed value ("%E0%A4") must not turn every request into a 500
    try {
      return decodeURIComponent(v.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isHttps(req: IncomingMessage) {
  return (req.socket as { encrypted?: boolean }).encrypted || req.headers["x-forwarded-proto"] === "https";
}

/**
 * Secure is always set in production. On http://localhost during development it's
 * left off so Safari accepts the cookie (Chrome/Firefox treat localhost as secure anyway).
 */
function cookieAttrs(req: IncomingMessage) {
  const secure = isProduction() || isHttps(req) || env("COOKIE_SECURE") === "1";
  return `Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

function setSessionCookie(req: IncomingMessage, res: ServerResponse, token: string) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Max-Age=${SESSION_SECONDS}; ${cookieAttrs(req)}`);
}

export function clearSessionCookie(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`);
}

/* ------------------------------ sessions ------------------------------ */

/** After a successful login: a new server-side session + the signed cookie that points to it. */
export async function startAdminSession(req: IncomingMessage, res: ServerResponse, username: string) {
  const sid = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO admin_sessions (id, username, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + make_interval(secs => $3), $4, $5)`,
    [sha256(sid), username, SESSION_SECONDS, clientIp(req), String(req.headers["user-agent"] ?? "").slice(0, 300)],
  );
  void query("DELETE FROM admin_sessions WHERE expires_at < now()").catch(() => {});
  setSessionCookie(req, res, signSession(username, sid));
}

/** The signed-in admin, or null. The cookie must be valid AND its session not ended. */
export async function sessionFrom(req: IncomingMessage): Promise<{ sub: string; exp: number; sid: string } | null> {
  const session = verifySession(readCookie(req));
  if (!session) return null;
  const { rows } = await query<{ last_seen_at: Date }>("SELECT last_seen_at FROM admin_sessions WHERE id = $1 AND expires_at > now()", [sha256(session.sid)]);
  if (!rows[0]) return null;
  if (Date.now() - rows[0].last_seen_at.getTime() > 5 * 60_000) void query("UPDATE admin_sessions SET last_seen_at = now() WHERE id = $1", [sha256(session.sid)]).catch(() => {});
  return session;
}

/** Log out: ends this session on the server (the cookie stops working everywhere it was copied). */
export async function endAdminSession(req: IncomingMessage, res: ServerResponse) {
  const session = verifySession(readCookie(req));
  if (session) await query("DELETE FROM admin_sessions WHERE id = $1", [sha256(session.sid)]);
  clearSessionCookie(req, res);
}

/** "Log out everywhere": ends every admin session, including this one. Returns how many ended. */
export async function endAllAdminSessions(req: IncomingMessage, res: ServerResponse) {
  const { rowCount } = await query("DELETE FROM admin_sessions");
  clearSessionCookie(req, res);
  return rowCount ?? 0;
}

/* ------------------------------ client IP ------------------------------ */

const isLoopback = (ip: string) => ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
const isPrivate = (ip: string) => /^(::ffff:)?(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || /^f[cd][0-9a-f]{2}:/i.test(ip);
let warnedProxy = false;

/**
 * The visitor's IP, used by every rate limit.
 *
 * Behind a reverse proxy (nginx, Caddy…) every request arrives from the proxy, so using the
 * socket address would put ALL visitors in one rate-limit bucket — one person could then lock
 * everyone out of sign-in. So X-Forwarded-For is used (its LAST entry: the one our proxy added;
 * earlier entries are whatever the client sent and can be faked):
 *   - TRUST_PROXY=1      always (the proxy is on another machine / container)
 *   - TRUST_PROXY unset  only when the request comes from this machine (127.0.0.1 / ::1),
 *                        i.e. a proxy running on the same server — nobody else can connect from there
 *   - TRUST_PROXY=0      never
 */
export function clientIp(req: IncomingMessage) {
  const peer = req.socket.remoteAddress ?? "unknown";
  const mode = env("TRUST_PROXY");
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded && mode !== "0" && (mode === "1" || isLoopback(peer))) {
    const last = String(forwarded).split(",").pop()?.trim();
    if (last) return last;
  }
  if (forwarded && mode === undefined && isPrivate(peer) && !warnedProxy) {
    warnedProxy = true;
    console.warn(
      `[security] Requests arrive through a proxy at ${peer}, but TRUST_PROXY isn't set, so every visitor shares one rate limit. ` +
        "Set TRUST_PROXY=1 in .env.local if that proxy is yours (or TRUST_PROXY=0 to silence this).",
    );
  }
  return peer;
}

/* ------------------------------ rate limit ------------------------------ */

const attempts = new Map<string, { fails: number; lockedUntil: number; lastFail: number }>();
/** Failures from all IPs together (spread-out guessing) */
let globalFails: number[] = [];
let globalLockedUntil = 0;

/** Milliseconds left on a lock (this IP's, or the global one), or 0. */
export function lockRemaining(ip: string, now = Date.now()) {
  const own = attempts.get(ip);
  const ipLeft = own && own.lockedUntil > now ? own.lockedUntil - now : 0;
  const globalLeft = globalLockedUntil > now ? globalLockedUntil - now : 0;
  return Math.max(ipLeft, globalLeft);
}

export function recordFailure(ip: string, now = Date.now()) {
  // Forget stale entries so the map can't grow without bound
  if (attempts.size > 10_000) for (const [k, v] of attempts) if (v.lockedUntil <= now && now - v.lastFail > LOCK_MS) attempts.delete(k);
  const a = attempts.get(ip);
  // A lock that ran out, or failures older than the lock window, start the count again
  const stale = !a || (a.lockedUntil && a.lockedUntil <= now) || now - a.lastFail > LOCK_MS;
  const fails = (stale ? 0 : a.fails) + 1;
  attempts.set(ip, { fails, lockedUntil: fails >= MAX_FAILS ? now + LOCK_MS : 0, lastFail: now });

  globalFails = [...globalFails.filter((t) => now - t < GLOBAL_WINDOW_MS), now];
  if (globalFails.length >= GLOBAL_MAX_FAILS && globalLockedUntil <= now) {
    globalLockedUntil = now + GLOBAL_WINDOW_MS;
    globalFails = [];
    console.warn(`[admin] ${GLOBAL_MAX_FAILS} failed admin logins in 15 minutes from different addresses — admin sign-in is paused for 15 minutes.`);
  }
  const locked = lockRemaining(ip, now) > 0;
  return { fails, locked, remaining: Math.max(0, MAX_FAILS - fails), retryAfterMs: lockRemaining(ip, now) };
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
}

/** For tests: forget every failure and lock. */
export function resetAdminLockouts() {
  attempts.clear();
  globalFails = [];
  globalLockedUntil = 0;
}
