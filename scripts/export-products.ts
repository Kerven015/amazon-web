/**
 * Writes data/products.json from the original mock catalogue
 * (src/lib/mock-data/products.ts). Run once to seed:  npm run data:seed
 *
 * ⚠ Overwrites admin changes. Pass --force to replace an existing file.
 * Built-in illustrations aren't stored (the browser draws them), so the file stays small.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { products } from "../src/lib/mock-data/products";
import type { Product, ProductRecord } from "../src/types";
import { toRecord } from "./product-translations";

const out = path.resolve("data/products.json");
if (existsSync(out) && !process.argv.includes("--force")) {
  console.error(`${out} already exists — it may contain admin edits. Re-run with --force to overwrite.`);
  process.exit(1);
}

const isArt = (src?: string) => !!src && src.startsWith("data:");

const plain: Product[] = products.map((p) => ({
  ...p,
  sku: p.specs.find((s) => s.label === "Model")?.value ?? p.id.toUpperCase(),
  stockStatus: "auto",
  images: p.images.filter((i) => !isArt(i.src)),
  variants: {
    ...p.variants,
    colors: p.variants.colors?.map(({ images, ...c }) => ({
      ...c,
      image: isArt(c.image) ? "" : c.image,
      ...(images && !images.some((i) => isArt(i.src)) ? { images } : {}),
    })),
  },
}));

// English + Turkish + Turkmen text per product
const data: ProductRecord[] = plain.map(toRecord);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`Wrote ${data.length} products to ${path.relative(process.cwd(), out)}`);
