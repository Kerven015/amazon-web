/**
 * Adds Russian (ru) text to every product in data/products.json, using the same
 * dictionaries as the seed (scripts/product-translations.ts, src/lib/term-translations.ts).
 * Only EMPTY Russian fields are filled, so anything typed in /admin is kept.
 * Safe to re-run.
 *   npx tsx scripts/add-russian.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { L10n, L10nList, NameL10n, ProductRecord } from "../src/types";
import { care, colours, descriptionL10n, featureL10n, highlights, listL10n, materials, noteL10n, origins, sizes, taglines, titles, weaves } from "./product-translations";

const file = path.resolve("data/products.json");
const list = JSON.parse(readFileSync(file, "utf8")) as ProductRecord[];
let filled = 0;

const fill = (v: L10n | undefined, ru: string | undefined) => {
  if (v && !v.ru?.trim() && ru) {
    v.ru = ru;
    filled++;
  }
};
const fillList = (v: L10nList, ru: string[] | undefined) => {
  if (!v.ru?.some((x) => x.trim()) && ru?.length) {
    v.ru = ru;
    filled++;
  }
};
const fillName = (labels: NameL10n | undefined, ru: string | undefined): NameL10n | undefined => {
  if (!ru || labels?.ru?.trim()) return labels;
  filled++;
  return { ...labels, ru };
};

for (const p of list) {
  const title = titles[p.id];
  const tagline = taglines[p.id];
  fill(p.title, title?.ru);
  fill(p.tagline, tagline?.ru);
  if (title && tagline) fill(p.description, descriptionL10n({ ...p, description: p.description.en, material: p.material.en }, title, tagline).ru);
  fillList(p.features, listL10n(p.features.en, featureL10n).ru);
  fillList(p.highlights, listL10n(p.highlights.en, (h) => highlights[h]).ru);
  fill(p.material, materials[p.material.en]?.ru);
  fill(p.weave, p.weave && weaves[p.weave.en]?.ru);
  fill(p.origin, p.origin && origins[p.origin.en]?.ru);
  for (const c of p.careInstructions) fill(c.text, care[c.text.en]?.ru);
  for (const s of p.sizes) {
    s.labels = fillName(s.labels, sizes[s.name]?.ru);
    if (s.note) fill(s.note, noteL10n(s.note.en).ru);
  }
  for (const c of p.variants.colors ?? []) c.labels = fillName(c.labels, colours[c.name]?.ru);
}

writeFileSync(file, JSON.stringify(list, null, 2));
console.log(`Filled ${filled} Russian field(s) across ${list.length} products in ${path.relative(process.cwd(), file)}`);
