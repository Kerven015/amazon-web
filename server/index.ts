/**
 * Production server: `npm run build && npm start`.
 * Serves the API, uploaded images, the built app (dist/) and the SPA fallback.
 * Needs a host with a persistent disk (data/products.json and uploads are files).
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { guardAdminPage, handleApi, localeRedirect, withHtmlLang } from "./app";
import { env, loadEnv } from "./env";
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

createServer(async (req, res) => {
  try {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (await handleApi(req, res)) return;
    if (guardAdminPage(req, res)) return;
    if (localeRedirect(req, res)) return;

    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
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
    res.statusCode = 500;
    res.end("Server error");
  }
}).listen(port, () => console.log(`Vendora running on http://localhost:${port}`));
