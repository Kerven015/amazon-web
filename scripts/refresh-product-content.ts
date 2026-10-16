/**
 * Brings data/products.json up to date with the current content rules, without
 * touching anything an admin changed:
 *
 *   - reviews: regenerated for every product (unique text, unique authors, the
 *     size/colour bought is always in stock); reviewCount and rating become the
 *     real count and average
 *   - generated highlights, features, care lines and descriptions are replaced
 *     only while they still equal what the old generator wrote
 *   - launch dates in the future are moved into the past (NEW IN = last 30 days)
 *   - Turkish "banyo çarşafı" → "büyük banyo havlusu"; p14 is a bamboo-cotton blend
 *     and gets realistic stock
 *
 *   npm run data:refresh
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { averageRating, buildReviews, type ReviewInput } from "../src/lib/mock-data/product-details";
import { SEED_TODAY, TOWEL_LAUNCH, products as seeded, towelRange } from "../src/lib/mock-data/products";
import type { ProductRecord } from "../src/types";
import { toRecord } from "./product-translations";

const file = path.resolve("data/products.json");
const records = JSON.parse(readFileSync(file, "utf8")) as ProductRecord[];
const fresh = new Map(seeded.map((p) => [p.id, toRecord(p)]));
const targets = new Map(towelRange.map((p) => [p.id, p.rating]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const log: string[] = [];

/* What the previous generator wrote, so admin edits can be told apart. */
const OLD_HIGHLIGHTS = [
  "OEKO-TEX certified, free from harmful substances",
  "Pre-washed for softness from day one",
  "Absorbent loops that get fluffier with every wash",
  "Free personalisation on selected styles",
];
const OLD_CARE = new Set([
  "Machine wash at 30°C. Skip fabric softener so fibres stay thirsty.",
  "Machine wash at 40°C with similar colours. Skip fabric softener so loops stay absorbent.",
  "Do not bleach.",
  "Line dry, or tumble dry low and remove while slightly damp.",
  "Tumble dry on low, or line dry and shake out for extra fluff.",
  "Warm iron while damp if you like a crisp finish.",
  "Do not iron — it flattens the loops.",
  "Do not dry clean.",
]);
const OLD_DESCRIPTION = /^.+ from .+: .+\. (At \d+ GSM it feels .+, )?woven from .+ and pre-washed so it's soft from the very first use\. Made to be used every day and to get better with every wash\.$/;
const today = SEED_TODAY;

for (const r of records) {
  const f = fresh.get(r.id);
  const changed: string[] = [];

  // Launch dates: seeded towels use their planned date; anything in the future becomes today.
  const launch = TOWEL_LAUNCH[r.id];
  if (launch && r.createdAt !== launch) {
    r.createdAt = launch;
    changed.push("createdAt");
  } else if (new Date(r.createdAt) > today) {
    r.createdAt = today.toISOString();
    changed.push("createdAt");
  }

  if (f) {
    if (r.material.en === "Bamboo cotton") {
      r.material = f.material;
      r.specs = r.specs.map((s) => (s.label === "Material" ? { ...s, value: f.material.en } : s));
      changed.push("material");
    }
    if (same(r.highlights.en, OLD_HIGHLIGHTS) && !same(r.highlights, f.highlights)) {
      r.highlights = f.highlights;
      changed.push("highlights");
    }
    if (r.careInstructions.length && r.careInstructions.every((c) => OLD_CARE.has(c.text.en)) && !same(r.careInstructions, f.careInstructions)) {
      r.careInstructions = f.careInstructions;
      changed.push("care");
    }
    // Features: replace the generated list (e.g. "100% bamboo cotton") when only the generator wrote it
    if (r.features.en[0]?.startsWith("100% bamboo") || (r.features.en.length === f.features.en.length && r.features.en.slice(1).every((x, i) => x === f.features.en[i + 1]) && !same(r.features, f.features))) {
      r.features = f.features;
      changed.push("features");
    }
    if (OLD_DESCRIPTION.test(r.description.en) && !same(r.description, f.description)) {
      r.description = f.description;
      changed.push("description");
    }
    // p14 had 1–2 units per variant, so "Only 1 left" showed almost everywhere
    const cells = r.sizes.flatMap((s) => Object.values(s.stock)).filter((n) => n > 0);
    if (r.id === "p14" && cells.length && Math.max(...cells) <= 3) {
      r.sizes = r.sizes.map((s) => ({ ...s, stock: f.sizes.find((x) => x.name === s.name)?.stock ?? s.stock }));
      r.stock = r.sizes.reduce((n, s) => n + Object.values(s.stock).reduce((a, b) => a + b, 0), 0);
      changed.push("stock");
    }
  }

  // Turkish: "banyo çarşafı" reads as a bed sheet
  const before = JSON.stringify(r);
  const after = before.replace(/Banyo çarşafı/g, "Büyük banyo havlusu").replace(/banyo çarşafı/g, "büyük banyo havlusu");
  if (after !== before) {
    Object.assign(r, JSON.parse(after));
    changed.push("tr bath sheet");
  }

  if (changed.length) log.push(`${r.id}: ${changed.join(", ")}`);
}

/* Reviews for every product in one pass (no text repeats between products). */
const inputs: ReviewInput[] = records.map((r) => ({
  id: r.id,
  title: r.title.en,
  productType: r.productType,
  material: r.material.en,
  weave: r.weave?.en,
  design: r.design,
  gsm: r.weightGsm,
  rating: targets.get(r.id) ?? (r.rating || 4.6),
  createdAt: r.createdAt,
  sizes: r.sizes.map((s) => ({ name: s.name, note: s.note?.en, stock: s.stock })),
  colours: (r.variants.colors ?? []).map((c) => c.name),
}));
const reviews = buildReviews(inputs, today);
for (const r of records) {
  const list = reviews.get(r.id) ?? [];
  r.reviews = list;
  r.reviewCount = list.length;
  r.rating = averageRating(list, r.rating);
}
log.push(`reviews: ${records.map((r) => `${r.id}×${r.reviewCount} (${r.rating})`).join(", ")}`);

writeFileSync(file, JSON.stringify(records, null, 2));
console.log(log.join("\n"));
