/**
 * Admin authentication.
 * - Credentials come from .env.local (ADMIN_USERNAME / ADMIN_PASSWORD) and are
 *   compared in constant time.
 * - Sessions are HS256-signed JWTs (ADMIN_SESSION_SECRET) in an httpOnly,
 *   SameSite=Strict cookie that expires after 8 hours.
 * - 5 failed attempts from one IP lock login for 5 minutes.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env, isProduction } from "./env";

export const COOKIE = "vendora_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

/* ------------------------------ config ------------------------------ */

export function authConfig() {
  const username = env("ADMIN_USERNAME");
  const password = env("ADMIN_PASSWORD");
  const secret = env("ADMIN_SESSION_SECRET");
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
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

export function signSession(username: string, now = Date.now()) {
  const cfg = authConfig();
  if (!cfg) throw new Error("Admin auth is not configured");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const iat = Math.floor(now / 1000);
  const payload = b64(JSON.stringify({ sub: username, role: "admin", iat, exp: iat + SESSION_SECONDS }));
  const sig = createHmac("sha256", cfg.secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifySession(token: string | undefined, now = Date.now()): { sub: string; exp: number } | null {
  const cfg = authConfig();
  if (!cfg || !token) return null;
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
    return { sub: String(data.sub), exp: data.exp };
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

export function setSessionCookie(req: IncomingMessage, res: ServerResponse, token: string) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Max-Age=${SESSION_SECONDS}; ${cookieAttrs(req)}`);
}

export function clearSessionCookie(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`);
}

export function sessionFrom(req: IncomingMessage) {
  return verifySession(readCookie(req));
}

/* ------------------------------ rate limit ------------------------------ */

const attempts = new Map<string, { fails: number; lockedUntil: number; lastFail: number }>();

export function clientIp(req: IncomingMessage) {
  if (env("TRUST_PROXY") === "1") {
    // The LAST entry is the one our proxy added; earlier ones are whatever the client sent,
    // so trusting the first would let anyone dodge the rate limits with a fake header
    const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",").pop()?.trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress ?? "unknown";
}

/** Milliseconds left on a lock, or 0. */
export function lockRemaining(ip: string, now = Date.now()) {
  const a = attempts.get(ip);
  if (!a || a.lockedUntil <= now) return 0;
  return a.lockedUntil - now;
}

export function recordFailure(ip: string, now = Date.now()) {
  // Forget stale entries so the map can't grow without bound
  if (attempts.size > 10_000) for (const [k, v] of attempts) if (v.lockedUntil <= now && now - v.lastFail > LOCK_MS) attempts.delete(k);
  const a = attempts.get(ip);
  // A lock that ran out, or failures older than the lock window, start the count again
  const stale = !a || (a.lockedUntil && a.lockedUntil <= now) || now - a.lastFail > LOCK_MS;
  const fails = (stale ? 0 : a.fails) + 1;
  attempts.set(ip, { fails, lockedUntil: fails >= MAX_FAILS ? now + LOCK_MS : 0, lastFail: now });
  return { fails, locked: fails >= MAX_FAILS, remaining: Math.max(0, MAX_FAILS - fails) };
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
}
