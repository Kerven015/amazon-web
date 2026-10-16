/**
 * One-time product photo fetcher (Pexels → local WebP files).
 *
 *   1. Put your key in .env.local:   PEXELS_API_KEY=xxxxxxxx
 *   2. Run:                          npx tsx scripts/fetch-product-images.ts
 *
 * For every product in src/lib/mock-data/products.ts it saves, under
 * public/images/products/{product-slug}/:
 *   main.webp, gallery-1.webp … gallery-3.webp, {colour-slug}.webp (one per extra colour)
 * Editorial photos (hero ×3, collection tiles ×6, quiz banner, newsletter) go to
 *   public/images/editorial/{file}.webp, cropped to the exact size in src/lib/editorial.ts.
 * and writes:
 *   src/lib/mock-data/editorial-manifest.json – editorial paths + blur placeholders (read by photo())
 *   src/lib/mock-data/image-manifest.json  – paths + tiny blur placeholders (read by the mock data)
 *   src/lib/mock-data/image-credits.json   – Pexels photo id, photographer and URLs for /credits
 *
 * Safe to re-run: existing files are kept, progress is saved after every product,
 * and if the Pexels hourly limit is hit it stops cleanly so you can run it again later.
 * The API key is only read here (Node); it is never bundled into the site.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  colorSearchTerms,
  products,
  slugify,
  type ImageCredit,
  type ManifestEntry,
  type ManifestImage,
} from "../src/lib/mock-data/products";
import { editorialSlots, type EditorialEntry } from "../src/lib/editorial";
import type { Product, ProductRecord } from "../src/types";

/* ----------------------------- Settings ----------------------------- */

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "images", "products");
const MANIFEST_PATH = path.join(ROOT, "src", "lib", "mock-data", "image-manifest.json");
const CREDITS_PATH = path.join(ROOT, "src", "lib", "mock-data", "image-credits.json");
const EDITORIAL_DIR = path.join(ROOT, "public", "images", "editorial");
const EDITORIAL_MANIFEST_PATH = path.join(ROOT, "src", "lib", "mock-data", "editorial-manifest.json");
const PEXELS_SEARCH = process.env.PEXELS_API_BASE ?? "https://api.pexels.com/v1/search";
const GALLERY_COUNT = 3;
const MAX_SIDE = 1200;
const QUALITY = 80;
const REQUEST_GAP_MS = 300;
const MAX_PAGES_PER_QUERY = 4;

/* ------------------------------ Types ------------------------------- */

type PexelsPhoto = {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt?: string;
  src: { large: string; large2x?: string; original?: string };
};
type PexelsResponse = { photos: PexelsPhoto[]; next_page?: string };

class RateLimitError extends Error {}

/* ------------------------------ Helpers ----------------------------- */

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Retries once on network/5xx failure. Throws RateLimitError on 429. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    console.warn(`  ↻ retrying ${label}: ${(err as Error).message}`);
    await sleep(1500);
    return fn();
  }
}

/* ------------------------- Search queries --------------------------- */

const colourWord = (name?: string) => (name ? (colorSearchTerms[name] ?? name.toLowerCase()) : "");

/** Search query for a product type + colour (towel types follow the brief; others use their own type). */
function queryFor(product: Product, colourName?: string) {
  const c = colourWord(colourName);
  const sizes = product.variants.sizes ?? [];
  switch (product.productType) {
    case "Bath Towels":
    case "Towels":
      return sizes.length === 1 && sizes[0] === "Bath sheet" ? `folded bath sheet ${c}` : `folded bath towels ${c}`;
    case "Beach Towels":
      return product.design === "Patterned" ? `striped beach towel ${c}` : `beach towel ${c}`;
    case "Baby Towels":
      return `hooded baby towel ${c}`;
    case "Kitchen Towels":
      return `kitchen tea towel ${c}`;
    case "Bath Mats":
      return `bath mat bathroom floor ${c}`;
    case "Bathrobes":
      return c && c !== "white" ? `${c} bathrobe hanging` : "white bathrobe hanging";
    case "Towel Bundles":
      return `stack of towels ${c}`;
    default:
      // Non-towel products in the mock catalogue get a photo of what they are.
      return `${product.productType.toLowerCase()} ${c}`.trim();
  }
}

/* --------------------------- Pexels client -------------------------- */

const cache = new Map<string, PexelsPhoto[]>();
const pagesFetched = new Map<string, number>();
let lastRequest = 0;
let requestCount = 0;

async function searchPage(query: string, page: number, orientation: "portrait" | "square" | "landscape"): Promise<PexelsResponse> {
  const wait = REQUEST_GAP_MS - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  requestCount++;
  const url = `${PEXELS_SEARCH}?${new URLSearchParams({ query, orientation, per_page: "15", page: String(page) })}`;
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY! } });
  if (res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = reset ? new Date(reset * 1000).toLocaleTimeString() : "later";
    throw new RateLimitError(`Pexels rate limit reached — run the script again after ${when}.`);
  }
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${query}"`);
  return (await res.json()) as PexelsResponse;
}

/** Returns the next photo for a query that hasn't been used anywhere yet. */
async function nextUnused(query: string, used: Set<number>): Promise<PexelsPhoto | null> {
  for (;;) {
    const pool = cache.get(query) ?? [];
    const hit = pool.find((p) => !used.has(p.id));
    if (hit) {
      used.add(hit.id);
      return hit;
    }
    const fetched = pagesFetched.get(query) ?? 0;
    if (fetched >= MAX_PAGES_PER_QUERY) return null;
    // Page 1-2 portrait, then square (both suit a 4:5 crop)
    const orientation = fetched < 2 ? "portrait" : "square";
    const page = orientation === "portrait" ? fetched + 1 : fetched - 1;
    const data = await withRetry(() => searchPage(query, page, orientation), `"${query}" p${page}`);
    pagesFetched.set(query, fetched + 1);
    cache.set(query, [...pool, ...data.photos.filter((p) => !pool.some((q) => q.id === p.id))]);
    if (!data.photos.length && fetched + 1 >= MAX_PAGES_PER_QUERY) return null;
  }
}

/* ------------------------- Download + convert ----------------------- */

async function blurFor(buffer: Buffer) {
  const tiny = await sharp(buffer).resize(16, 20, { fit: "cover" }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${tiny.toString("base64")}`;
}

async function saveWebp(photo: PexelsPhoto, file: string): Promise<string> {
  const res = await withRetry(async () => {
    // "large2x" is Pexels' large size at 2× density (~1300px), so the 1200px WebP stays sharp;
    // plain "large" is capped at 650px tall, which is too small for portrait shots.
    const r = await fetch(photo.src.large2x ?? photo.src.large);
    if (!r.ok) throw new Error(`download ${r.status}`);
    return r;
  }, `download ${photo.id}`);
  const input = Buffer.from(await res.arrayBuffer());
  const out = await sharp(input)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  writeFileSync(file, out);
  return blurFor(out);
}

/* ----------------------------- Editorial ---------------------------- */

/** Hero, collection tiles, quiz banner and newsletter: one photo each, cropped to the slot's exact size. */
async function fetchEditorial(used: Set<number>, credits: ImageCredit[]): Promise<ImageCredit[]> {
  mkdirSync(EDITORIAL_DIR, { recursive: true });
  const manifest = readJson<Record<string, EditorialEntry>>(EDITORIAL_MANIFEST_PATH, {});
  const save = () => writeFileSync(EDITORIAL_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const slot of editorialSlots) {
    const file = path.join(EDITORIAL_DIR, `${slot.file}.webp`);
    const src = `/images/editorial/${slot.file}.webp`;
    if (existsSync(file)) {
      manifest[slot.seed] = manifest[slot.seed]?.src === src ? manifest[slot.seed] : { src, blurDataURL: await blurFor(readFileSync(file)) };
      continue;
    }
    let photo: PexelsPhoto | undefined;
    for (let page = 1; page <= 2 && !photo; page++) {
      const data = await withRetry(() => searchPage(slot.query, page, slot.orientation), `"${slot.query}"`);
      photo = data.photos.find((p) => !used.has(p.id));
    }
    if (!photo) {
      console.warn(`  ✗ editorial ${slot.file}: no photo found — the illustration stays`);
      continue;
    }
    used.add(photo.id);
    const res = await withRetry(async () => {
      const r = await fetch(photo!.src.original ?? photo!.src.large2x ?? photo!.src.large);
      if (!r.ok) throw new Error(`download ${r.status}`);
      return r;
    }, `download ${photo.id}`);
    const out = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize(slot.width, slot.height, { fit: "cover", position: "attention" })
      .webp({ quality: QUALITY })
      .toBuffer();
    writeFileSync(file, out);
    manifest[slot.seed] = { src, blurDataURL: await blurFor(out) };
    credits = credits.filter((c) => c.file !== src);
    credits.push({ productId: "editorial", file: src, pexelsId: photo.id, photographer: photo.photographer, photographerUrl: photo.photographer_url, pexelsUrl: photo.url });
    save();
    console.log(`✓ editorial ${slot.file} (${slot.width}×${slot.height})`);
  }
  // Drop entries whose file was deleted, so photo() falls back to the illustration.
  for (const [seed, entry] of Object.entries(manifest)) {
    if (!existsSync(path.join(ROOT, "public", entry.src))) delete manifest[seed];
  }
  save();
  return credits;
}

/* ------------------------------- Main ------------------------------- */

type Row = { product: string; saved: number; skipped: number; missing: string };

async function main() {
  loadEnvLocal();
  if (!process.env.PEXELS_API_KEY) {
    console.error("Missing PEXELS_API_KEY. Add it to .env.local, then run: npx tsx scripts/fetch-product-images.ts");
    process.exit(1);
  }

  const manifest = readJson<Record<string, ManifestEntry>>(MANIFEST_PATH, {});
  let credits = readJson<ImageCredit[]>(CREDITS_PATH, []);
  const used = new Set<number>(credits.map((c) => c.pexelsId));
  const rows: Row[] = [];

  const persist = () => {
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(CREDITS_PATH, `${JSON.stringify(credits, null, 2)}\n`);
  };

  try {
    credits = await fetchEditorial(used, credits);
    persist();
    for (const product of products) {
      const dir = path.join(OUT_DIR, product.slug);
      mkdirSync(dir, { recursive: true });
      const entry: ManifestEntry = manifest[product.id] ?? {};
      const colours = product.variants.colors ?? [];
      const mainColour = colours[0]?.name;
      const row: Row = { product: `${product.id} ${product.title}`, saved: 0, skipped: 0, missing: "" };
      const missing: string[] = [];

      /** Saves one image unless the file already exists. Tries each query in order. */
      const ensure = async (fileName: string, queries: string[]): Promise<ManifestImage | null> => {
        const file = path.join(dir, fileName);
        const src = `/images/products/${product.slug}/${fileName}`;
        if (existsSync(file)) {
          row.skipped++;
          const known = [entry.main, ...(entry.gallery ?? []), ...Object.values(entry.colors ?? {})].find((m) => m?.src === src);
          return known ?? { src, blurDataURL: await blurFor(readFileSync(file)) };
        }
        let photo: PexelsPhoto | null = null;
        for (const q of queries) {
          photo = await nextUnused(q, used);
          if (photo) break;
        }
        if (!photo) {
          missing.push(fileName);
          return null;
        }
        const blurDataURL = await saveWebp(photo, file);
        credits = credits.filter((c) => c.file !== src);
        credits.push({
          productId: product.id,
          file: src,
          pexelsId: photo.id,
          photographer: photo.photographer,
          photographerUrl: photo.photographer_url,
          pexelsUrl: photo.url,
        });
        row.saved++;
        return { src, blurDataURL };
      };

      // Coloured query first, then the same query without a colour if Pexels runs dry.
      const queries = (colour?: string) => [...new Set([queryFor(product, colour), queryFor(product)])];

      // 1. Main image (in the first colour)
      const main = await ensure("main.webp", queries(mainColour));
      if (main) entry.main = main;

      // 2. Gallery, ideally in the same colour family
      const gallery: ManifestImage[] = [];
      for (let i = 1; i <= GALLERY_COUNT; i++) {
        const g = await ensure(`gallery-${i}.webp`, queries(mainColour));
        if (g) gallery.push(g);
      }
      entry.gallery = gallery;

      // 3. One image per extra colour variant (the first colour uses main.webp)
      entry.colors = entry.colors ?? {};
      for (const colour of colours.slice(1)) {
        const slug = slugify(colour.name);
        const img = await ensure(`${slug}.webp`, queries(colour.name));
        if (img) entry.colors[slug] = img;
      }

      manifest[product.id] = entry;
      row.missing = missing.join(", ");
      rows.push(row);
      persist();
      console.log(`✓ ${row.product}: ${row.saved} saved, ${row.skipped} already there${row.missing ? `, missing ${row.missing}` : ""}`);
    }
  } catch (err) {
    persist();
    if (err instanceof RateLimitError) {
      console.warn(`\n⏸  ${err.message}\n   Progress is saved; finished products will be skipped next time.`);
    } else {
      throw err;
    }
  }

  console.log(`\nPexels requests this run: ${requestCount}\n`);
  console.table(rows.map((r) => ({ product: r.product, "images saved": r.saved, "already there": r.skipped, missing: r.missing || "—" })));
  const incomplete = products.filter((p) => !manifest[p.id]?.main);
  if (incomplete.length) console.log(`\n${incomplete.length} product(s) still without a main image: ${incomplete.map((p) => p.id).join(", ")}`);

  applyToCatalog(manifest);
}

/**
 * Put the downloaded photos into data/products.json (the live catalogue), but
 * only for products that still have no photos — images added in /admin win.
 */
function applyToCatalog(manifest: Record<string, ManifestEntry>) {
  const file = path.join(ROOT, "data", "products.json");
  if (!existsSync(file)) return;
  const catalog = JSON.parse(readFileSync(file, "utf8")) as ProductRecord[];
  let changed = 0;
  for (const p of catalog) {
    const entry = manifest[p.id];
    // Generated illustrations (data: URLs) don't count as photos.
    if (!entry?.main || p.images.some((i) => i.src && !i.src.startsWith("data:"))) continue;
    // Empty alt → the store describes the photo in each language (see localizeProduct)
    const alt = (_n?: number) => "";
    p.images = [
      { src: entry.main.src, alt: alt(), blurDataURL: entry.main.blurDataURL },
      ...(entry.gallery ?? []).map((g, i) => ({ src: g.src, alt: alt(i + 2), blurDataURL: g.blurDataURL })),
    ];
    p.variants.colors = p.variants.colors?.map((c, i) => {
      const own = i === 0 ? entry.main : (entry.colors?.[slugify(c.name)] ?? entry.main);
      return { ...c, image: own!.src, imageBlur: own!.blurDataURL, images: undefined };
    });
    changed++;
  }
  if (changed) {
    writeFileSync(file, JSON.stringify(catalog, null, 2));
    console.log(`\nUpdated photos for ${changed} product(s) in data/products.json`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
