/**
 * Security headers (helmet), CORS (cors) and a small in-memory rate limiter.
 * Used by the production server (server/index.ts) and the Vite dev/preview server.
 *
 * - helmet: Content-Security-Policy (production only — Vite's dev server needs inline
 *   scripts), HSTS (production only), X-Content-Type-Options, X-Frame-Options, etc.
 *   The CSP allows only this site plus Google Identity Services ("Continue with Google").
 * - cors: the site calls its own API from the same origin, so by default no other origin
 *   is allowed. Extra origins (e.g. a separate admin app) go in CORS_ORIGINS, comma separated.
 *   The same list is accepted by the same-origin check in server/http.ts.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import helmet from "helmet";
import { env, isProduction } from "./env";

/* ------------------------------ CORS ------------------------------ */

let origins: Set<string> | null = null;

/** Origins from CORS_ORIGINS ("https://a.example, https://b.example"), normalised. */
export function allowedOrigins() {
  origins ??= new Set(
    (env("CORS_ORIGINS") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .flatMap((o) => {
        try {
          return [new URL(o).origin];
        } catch {
          console.warn(`[security] ignoring invalid CORS_ORIGINS entry: ${o}`);
          return [];
        }
      }),
  );
  return origins;
}

export const isAllowedOrigin = (origin: string | undefined) => !!origin && allowedOrigins().has(origin);

const corsMiddleware = cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600,
});

/* ------------------------------ helmet ------------------------------ */

const GSI = "https://accounts.google.com/gsi/";

/** 'sha256-…' sources for the inline <script>s in the built index.html (the theme snippet). */
export function inlineScriptHashes(html: string) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter((m) => m[1].trim())
    .map((m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`);
}

function buildHelmet(scriptHashes: string[]) {
  const prod = isProduction();
  return helmet({
    contentSecurityPolicy: prod
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", `${GSI}client`, ...scriptHashes],
            // React / motion set inline style attributes; Google's button has its own stylesheet
            styleSrc: ["'self'", "'unsafe-inline'", `${GSI}style`],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'", GSI],
            frameSrc: [GSI],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            // HSTS covers https; this would break `npm start` tried out over plain http
            upgradeInsecureRequests: null,
          },
        }
      : false,
    // Google sign-in opens a popup that has to talk back to this page
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Google Identity Services needs the origin in the Referer
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: prod ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    frameguard: { action: "deny" },
  });
}

let helmetMiddleware: ReturnType<typeof helmet> | null = null;

/** Call once at start-up with the built index.html so its inline scripts are allowed by the CSP. */
export function configureSecurity(indexHtml = "") {
  helmetMiddleware = buildHelmet(inlineScriptHashes(indexHtml));
}

type Middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

/** Runs connect-style middleware; also settles when it answered the request itself (CORS preflight). */
function run(mw: Middleware, req: IncomingMessage, res: ServerResponse) {
  return new Promise<void>((resolve, reject) => {
    mw(req, res, (err) => (err ? reject(err) : resolve()));
    if (res.writableEnded) resolve();
  });
}

/**
 * Adds the security headers and handles CORS for /api/*.
 * Returns true when the request has been answered (a CORS preflight).
 */
export async function applySecurity(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  helmetMiddleware ??= buildHelmet([]);
  await run(helmetMiddleware as Middleware, req, res);
  if ((req.url ?? "").startsWith("/api/")) {
    await run(corsMiddleware as Middleware, req, res);
    if (res.writableEnded) return true;
  }
  return false;
}

/* ------------------------------ rate limit ------------------------------ */

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

/**
 * Fixed-window limiter: true while `key` has made at most `max` calls in the current window.
 * In memory, so it's per process — enough for one server; use a shared store if you run several.
 */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= max;
}
