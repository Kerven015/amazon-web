/** Small HTTP helpers shared by the admin API (app.ts) and the shop API (shop-api.ts). */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { z } from "zod";
import { isAllowedOrigin } from "./security";

export type Req = IncomingMessage;
export type Res = ServerResponse;

export function send(res: Res, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export class BodyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function readBody(req: Req, limit: number, tooLarge = "Request is too large"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > limit) {
      reject(new BodyError(413, tooLarge));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new BodyError(413, tooLarge));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readJson(req: Req, limit = 2 * 1024 * 1024): Promise<unknown> {
  const buf = await readBody(req, limit);
  try {
    return JSON.parse(buf.toString("utf8") || "{}");
  } catch {
    throw new BodyError(400, "Invalid JSON");
  }
}

/** A request body that failed its zod schema → 422 { error: "validation", fields }. */
export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("validation");
  }
}

/** Reads the JSON body and validates it; throws ValidationError with field → message. */
export async function parseBody<S extends z.ZodTypeAny>(req: Req, schema: S, limit = 100_000): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await readJson(req, limit));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_form"] ??= issue.message;
    throw new ValidationError(fields);
  }
  return parsed.data;
}

/**
 * Same-origin check for state-changing requests (defence in depth on top of SameSite cookies).
 * Origins listed in CORS_ORIGINS also pass.
 */
export function sameOrigin(req: Req) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) return true;
  // Browsers that send Fetch Metadata say outright when a request comes from another site
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  if (!origin) return true;
  try {
    // Behind a proxy / port forwarding (Codespaces, VS Code tunnels) the public host
    // arrives in X-Forwarded-Host while Host may be localhost:5173
    const host = new URL(origin).host;
    const forwarded = String(req.headers["x-forwarded-host"] ?? "").split(",")[0].trim();
    return host === req.headers.host || (!!forwarded && host === forwarded);
  } catch {
    return false;
  }
}

/** Validates the query string (?a=1&b=x) like parseBody does the body; empty values count as missing. */
export function parseQuery<S extends z.ZodTypeAny>(url: URL, schema: S): z.infer<S> {
  const raw = Object.fromEntries([...url.searchParams].filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_query"] ??= issue.message;
    throw new ValidationError(fields);
  }
  return parsed.data;
}
