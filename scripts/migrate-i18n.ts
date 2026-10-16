/**
 * One-off: converts data/products.json from English-only products to records
 * with { en, tr, tk } text (see scripts/product-translations.ts). Safe to re-run:
 * products that are already converted are left as they are.
 *   npx tsx scripts/migrate-i18n.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Product, ProductRecord } from "../src/types";
import { toRecord } from "./product-translations";

const file = path.resolve("data/products.json");
const list = JSON.parse(readFileSync(file, "utf8")) as (Product | ProductRecord)[];
let converted = 0;
const out = list.map((p) => {
  if (typeof (p as ProductRecord).title === "object") return p;
  converted++;
  return toRecord(p as Product);
});
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Converted ${converted} of ${list.length} products in ${path.relative(process.cwd(), file)}`);
