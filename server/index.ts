/**
 * Production server: `npm run build && npm start`.
 * Serves the API, uploaded images, the built app (dist/) and the SPA fallback.
 * Needs PostgreSQL (DATABASE_URL, see deploy/postgres-setup.md) and a persistent disk
 * for uploaded photos. Without a reachable database it prints why and exits.
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { guardAdminPage, handleApi, localeRedirect, withHtmlLang } from "./app";
import { assertDatabaseReady } from "./db/pool";
import { env, loadEnv } from "./env";
import { purgeDeleted } from "./lib/db/products";
import { applySecurity, configureSecurity } from "./security";
import { uploadDir } from "./upload";

process.env.NODE_ENV ??= "production";
loadEnv();
const root = process.cwd();
const dist = path.join(root, "dist");
const port = Number(env("PORT") ?? 3000);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/** Serve a file only if it resolves inside `base` (no path traversal). */
function serveFrom(base: string, rel: string, res: import("node:http").ServerResponse, cache: string) {
  const full = path.resolve(base, "." + rel);
  if (!full.startsWith(base + path.sep) || !existsSync(full) || !statSync(full).isFile()) return false;
  res.statusCode = 200;
  res.setHeader("Content-Type", TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream");
  res.setHeader("Cache-Control", cache);
  createReadStream(full).pipe(res);
  return true;
}

if (!existsSync(path.join(dist, "index.html"))) {
  console.error("dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

const indexHtml = readFileSync(path.join(dist, "index.html"), "utf8");
configureSecurity(indexHtml);

await assertDatabaseReady();
await purgeDeleted();

const server = createServer(async (req, res) => {
  try {
    if (await applySecurity(req, res)) return;
    if (await handleApi(req, res)) return;
    if (guardAdminPage(req, res)) return;
    if (localeRedirect(req, res)) return;

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    } catch {
      // Malformed %-escapes ("/%E0%A4%A") are the client's mistake, not a server error
      res.statusCode = 400;
      res.end("Bad request");
      return;
    }
    // Uploaded product photos (written after the build)
    if (pathname.startsWith("/images/products/") && serveFrom(uploadDir(), pathname.replace("/images/products", ""), res, "public, max-age=31536000, immutable")) return;
    // Built assets (hashed → cache forever) and other public files
    if (pathname !== "/" && serveFrom(dist, pathname, res, pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600")) return;
    // SPA fallback, with <html lang> set for the page's language
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(withHtmlLang(indexHtml, pathname));
  } catch (err) {
    console.error(err);
    if (res.headersSent) return void res.destroy();
    res.statusCode = 500;
    res.end("Server error");
  }
});
// Don't let slow or stalled clients hold connections open
server.headersTimeout = 20_000;
server.requestTimeout = 120_000;
server.listen(port, () => console.log(`Vendora running on http://localhost:${port}`));
