import type { CareInstruction, ProductSize, Review } from "@/types";
import { ANY_POOL, AUTHORS, CLOSERS, type PoolEntry, REVIEW_POOLS, type ReviewGroup } from "./review-pools";

/* ------------------------------------------------------------------
   Generators for the detail-page fields (sizes, features, care,
   reviews). Deterministic per product id so the mock is stable.
------------------------------------------------------------------- */

/** Small seeded PRNG (mulberry32) */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SizeSpec = { factor?: number; step?: number; widthCm?: number; lengthCm?: number; note?: string };

/** Towel sizes are priced as a multiple of the seed price (12 → $6 / $14 / $24 / $36). */
const SIZE_SPECS: Record<string, SizeSpec> = {
  "Face cloth": { factor: 0.5, widthCm: 30, lengthCm: 30 },
  "Hand towel": { factor: 7 / 6, widthCm: 50, lengthCm: 90 },
  "Bath towel": { factor: 2, widthCm: 70, lengthCm: 130 },
  "Bath sheet": { factor: 3, widthCm: 100, lengthCm: 150 },
  XS: { lengthCm: 110, note: "Chest 76–81 cm" },
  S: { lengthCm: 114, note: "Chest 86–91 cm" },
  M: { lengthCm: 117, note: "Chest 96–101 cm" },
  L: { lengthCm: 120, note: "Chest 106–111 cm" },
  XL: { lengthCm: 122, note: "Chest 116–121 cm" },
  "4-piece": { note: "2 bath towels, 2 hand towels" },
  "6-piece": { step: 16, note: "2 bath towels, 2 hand towels, 2 face cloths" },
  "8-piece": { step: 22, note: "2 bath sheets, 2 bath towels, 2 hand towels, 2 face cloths" },
  Hardcover: { step: 8 },
  "Whole bean": { step: 1 },
};

/** Dimensions for one-size products, by product type. */
const ONE_SIZE: Record<string, SizeSpec> = {
  "Bath Towels": { widthCm: 100, lengthCm: 180 },
  "Beach Towels": { widthCm: 100, lengthCm: 180 },
  "Baby Towels": { widthCm: 75, lengthCm: 75 },
  "Kitchen Towels": { widthCm: 50, lengthCm: 70 },
  "Bath Mats": { widthCm: 50, lengthCm: 80 },
  "Towel Bundles": { note: "Bathrobe, bath sheet and bath mat" },
};

const round = (n: number) => Math.round(n);

export function buildSizes(opts: {
  id: string;
  type: string;
  price: number;
  listPrice?: number;
  stock: number;
  sizes?: string[];
  colours: string[];
}): ProductSize[] {
  const names = opts.sizes?.length ? opts.sizes : ["One size"];
  const colours = opts.colours.length ? opts.colours : ["default"];
  const rand = rng(opts.id);
  const cells = names.length * colours.length;

  return names.map((name, si) => {
    const spec = opts.sizes?.length ? (SIZE_SPECS[name] ?? {}) : (ONE_SIZE[opts.type] ?? {});
    const at = (base: number) =>
      spec.factor ? round(base * spec.factor) : round((base + (si === 0 ? 0 : (spec.step ?? 0))) * 100) / 100;
    const sale = opts.listPrice ? at(opts.price) : undefined;
    const regular = opts.listPrice ? at(opts.listPrice) : at(opts.price);

    const stock: Record<string, number> = {};
    colours.forEach((c, ci) => {
      if (opts.stock <= 0) stock[c] = 0;
      // Demo: with 5+ colours the last one is sold out in every size
      else if (colours.length >= 5 && ci === colours.length - 1) stock[c] = 0;
      // Demo: the largest size in the first colour is running low
      else if (names.length > 1 && si === names.length - 1 && ci === 0) stock[c] = 3;
      else stock[c] = Math.max(1, round((opts.stock / cells) * (0.6 + rand() * 0.8)));
    });

    return {
      name,
      widthCm: spec.widthCm,
      lengthCm: spec.lengthCm,
      note: spec.note,
      price: regular,
      salePrice: sale,
      stock,
    };
  });
}

export function weaveFor(title: string, material: string): string | undefined {
  const t = `${title} ${material}`.toLowerCase();
  if (t.includes("waffle")) return "Honeycomb waffle weave";
  if (t.includes("ribbed")) return "Ribbed terry";
  if (t.includes("hammam")) return "Flat-woven peshtemal";
  if (t.includes("muslin")) return "Double-gauze muslin";
  if (t.includes("linen")) return "Plain-weave linen";
  if (t.includes("microfibre")) return "Microfibre knit";
  if (t.includes("velour")) return "Velour-sheared terry";
  if (t.includes("tufted")) return "Hand-tufted pile";
  if (t.includes("chenille")) return "Chenille pile";
  if (t.includes("plush") || t.includes("egyptian")) return "Long-loop terry";
  if (t.includes("cotton") || t.includes("bamboo")) return "Zero-twist terry loop";
  return undefined;
}

export function originFor(material: string): string | undefined {
  const m = material.toLowerCase();
  if (m.includes("turkish")) return "Woven in Denizli, Türkiye";
  if (m.includes("egyptian")) return "Egyptian Giza cotton, woven in Portugal";
  if (m.includes("linen")) return "Woven in Lithuania";
  if (m.includes("bamboo")) return "Made in Tamil Nadu, India";
  if (m.includes("microfibre")) return "Made from recycled bottles in Portugal";
  if (m.includes("cotton")) return "Woven in Guimarães, Portugal";
  return undefined;
}

/* ------------------------------ Fabric ------------------------------ */

/** What the towel is made like — decides which highlights, care lines and reviews fit. */
export type Fabric = "terry" | "waffle" | "flatweave" | "muslin" | "linen" | "microfibre" | "pile";

export function fabricOf(opts: { type: string; material: string; weave?: string; title?: string }): Fabric {
  const t = `${opts.title ?? ""} ${opts.material} ${opts.weave ?? ""}`.toLowerCase();
  if (t.includes("microfibre")) return "microfibre";
  if (t.includes("linen")) return "linen";
  if (t.includes("muslin") || t.includes("gauze")) return "muslin";
  if (t.includes("waffle")) return "waffle";
  if (t.includes("hammam") || t.includes("peshtemal") || t.includes("flat-woven")) return "flatweave";
  if (opts.type === "Bath Mats" || t.includes("tufted") || t.includes("chenille")) return "pile";
  return "terry";
}

/** Material in running text: "organic cotton", but "Turkish cotton" / "Egyptian cotton" keep their capitals. */
export function materialInText(material: string) {
  return material
    .split(" ")
    .map((w) => (/^(Turkish|Egyptian|Giza|OEKO-TEX)$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

/** One line on what makes this fabric good (shown as a highlight). */
const FABRIC_HIGHLIGHT: Record<Fabric, string> = {
  terry: "Absorbent loops that get fluffier with every wash",
  waffle: "Honeycomb weave that dries fast and stays light",
  flatweave: "Flat weave that dries fast and packs small",
  muslin: "Breathable double gauze that softens with every wash",
  linen: "Washed linen that stays lint-free and softens with age",
  microfibre: "Sheds sand easily and dries in no time",
  pile: "Dense pile that dries quickly between baths",
};

/** Highlights that are true for this product (no "pre-washed" linen, no "loops" on muslin…). */
export function highlightsFor(opts: { fabric: Fabric; personalisable?: boolean }): string[] {
  const out = ["OEKO-TEX certified, free from harmful substances"];
  if (opts.fabric !== "linen" && opts.fabric !== "microfibre") out.push("Pre-washed for softness from day one");
  out.push(FABRIC_HIGHLIGHT[opts.fabric]);
  if (opts.personalisable) out.push("Free personalisation on selected styles");
  return out;
}

export function featuresFor(opts: {
  isTextile: boolean;
  material: string;
  gsm?: number;
  quickDry: boolean;
  highlights: string[];
}): string[] {
  if (!opts.isTextile) return opts.highlights.slice(0, 4);
  const m = opts.material.toLowerCase();
  // Blends are named as blends — never "100%".
  const first = m.includes("microfibre") ? "Recycled microfibre" : m.includes("blend") ? opts.material.replace(/^\w/, (c) => c.toUpperCase()) : `100% ${materialInText(opts.material)}`;
  const out: string[] = [first];
  if (opts.gsm) {
    const feel = opts.gsm >= 600 ? "plush & heavy" : opts.gsm >= 400 ? "soft & absorbent" : "light & airy";
    out.push(`${opts.gsm} GSM – ${feel}`);
  }
  out.push(opts.quickDry ? "Quick-drying" : "Gets softer with every wash");
  out.push(m.includes("microfibre") || m.includes("muslin") ? "Machine wash 30°C" : "Machine wash 40°C");
  return out;
}

/** Care lines by fabric (English; translations live in lib/term-translations.ts → care). */
export function careFor(isTextile: boolean, material: string, fabric: Fabric = fabricOf({ type: "", material })): CareInstruction[] {
  if (!isTextile) return [];
  const cool = fabric === "microfibre" || fabric === "muslin";
  const wash = cool
    ? "Machine wash at 30°C. Skip fabric softener so fibres stay thirsty."
    : fabric === "terry"
      ? "Machine wash at 40°C with similar colours. Skip fabric softener so loops stay absorbent."
      : "Machine wash at 40°C with similar colours. Skip fabric softener so the fabric stays absorbent.";
  const dry =
    fabric === "linen"
      ? "Line dry, or tumble dry low and remove while slightly damp."
      : fabric === "terry" || fabric === "pile"
        ? "Tumble dry on low, or line dry and shake out for extra fluff."
        : "Tumble dry on low, or line dry.";
  const iron =
    fabric === "linen"
      ? "Warm iron while damp if you like a crisp finish."
      : fabric === "terry"
        ? "Do not iron — it flattens the loops."
        : fabric === "pile"
          ? "Do not iron."
          : "Cool iron if needed.";
  return [
    { kind: "wash", text: wash },
    { kind: "bleach", text: "Do not bleach." },
    { kind: "dry", text: dry },
    { kind: "iron", text: iron },
    { kind: "dryclean", text: "Do not dry clean." },
  ];
}

/** English description that matches the fabric (knitted microfibre, a blend for bamboo, no "pre-washed" linen). */
export function descriptionFor(opts: { title: string; brand: string; tagline: string; gsm?: number; feel: string; material: string; fabric: Fabric }) {
  const made = opts.fabric === "microfibre" ? "knitted from" : "woven from";
  const mat = /blend$/i.test(opts.material) ? `a ${materialInText(opts.material)}` : materialInText(opts.material);
  const prewashed = opts.fabric !== "linen" && opts.fabric !== "microfibre";
  const body = `${made} ${mat}${prewashed ? " and pre-washed so it's soft from the very first use" : ""}`;
  const lead = opts.gsm ? `At ${opts.gsm} GSM it feels ${opts.feel.toLowerCase()}, ${body}.` : `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
  const end = opts.fabric === "microfibre" ? "Made to be used every day and to dry in no time." : "Made to be used every day and to get better with every wash.";
  return `${opts.title} from ${opts.brand}: ${opts.tagline.toLowerCase()}. ${lead} ${end}`;
}

/* ------------------------------ Reviews ----------------------------- */

export type ReviewInput = {
  id: string;
  title: string;
  productType: string;
  material: string;
  weave?: string;
  design?: string;
  gsm?: number;
  /** Target average (the generator lands close to it; the stored rating is the real average) */
  rating: number;
  createdAt: string;
  sizes: { name: string; note?: string; stock: Record<string, number> }[];
  colours: string[];
};

/** Traits that decide which product-specific review lines fit (see review-pools.ts "only"). */
export function productTraits(p: ReviewInput): Set<string> {
  const fabric = fabricOf({ type: p.productType, material: p.material, weave: p.weave, title: p.title });
  const t = `${p.title} ${p.material} ${p.weave ?? ""}`.toLowerCase();
  const names = p.sizes.map((s) => s.name);
  const notes = p.sizes.map((s) => s.note ?? "").join(" ").toLowerCase();
  const traits = new Set<string>([fabric]);
  if (t.includes("bamboo")) traits.add("bamboo");
  if (t.includes("ribbed")) traits.add("ribbed");
  if (t.includes("velour")) traits.add("velour");
  if (t.includes("hooded")) traits.add("hooded");
  if (t.includes("reversible")) traits.add("reversible");
  if (t.includes("tufted")) traits.add("tufted");
  if (t.includes("shawl")) traits.add("shawl");
  if (p.design === "Patterned") traits.add("patterned");
  if (names.includes("Bath sheet")) traits.add("bath-sheet");
  if (p.colours.some((c) => ["Charcoal", "Slate", "Ink", "Midnight", "Lagoon"].includes(c))) traits.add("dark");
  p.colours.forEach((c) => traits.add(`colour:${c}`));
  if (p.productType === "Towel Bundles") {
    if (notes.includes("bathrobe")) traits.add("set:robe");
    if (notes.includes("face cloth")) traits.add("set:face");
    if (notes.includes("hand towel")) traits.add("set:hand");
    if (t.includes("guest")) traits.add("set:guest");
  }
  return traits;
}

export function reviewGroup(p: ReviewInput): ReviewGroup {
  const fabric = fabricOf({ type: p.productType, material: p.material, weave: p.weave, title: p.title });
  switch (p.productType) {
    case "Beach Towels":
      return "beach";
    case "Baby Towels":
      return "baby";
    case "Kitchen Towels":
      return "kitchen";
    case "Bath Mats":
      return "mat";
    case "Bathrobes":
      return "robe";
    case "Towel Bundles":
      return "bundle";
    default:
      if (fabric !== "terry") return "bath-light";
      return (p.gsm ?? 0) >= 600 ? "bath-plush" : "bath-mid";
  }
}

const DAY = 86_400_000;

/**
 * Reviews for the whole catalogue in one pass, so no text is used twice:
 * 4–7 per product (2–3 for products added in the last month), every author
 * different, text that fits the product type and weight, and size/colour
 * bought only from variants that are in stock. Dates fall between the
 * product's launch and `today`. Deterministic per product id.
 */
export function buildReviews(products: ReviewInput[], today: Date): Map<string, Review[]> {
  const usedText = new Set<string>();
  const usedCloser = new Set<string>();

  // Per-product setup
  const state = products.map((p) => {
    const rand = rng(`${p.id}-reviews-v2`);
    const traits = productTraits(p);
    const fits = ([, , , only]: PoolEntry) => !only || traits.has(only);
    const created = new Date(p.createdAt).getTime();
    const age = Math.max(0, today.getTime() - created);
    const want = age < 30 * DAY ? 2 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 4);
    const inStock = p.sizes.flatMap((s) =>
      (p.colours.length ? p.colours : ["default"]).filter((c) => (s.stock[c] ?? 0) > 0).map((c) => ({ size: s.name, colour: c === "default" ? undefined : c })),
    );
    return {
      p,
      rand,
      want,
      age,
      created,
      inStock,
      own: REVIEW_POOLS[reviewGroup(p)].filter(fits),
      any: ANY_POOL,
      authors: [...AUTHORS].sort(() => rand() - 0.5),
      list: [] as Review[],
      done: false,
    };
  });

  const stars = (target: number, r: number) => {
    if (target >= 4.7) return r < 0.8 ? 5 : r < 0.95 ? 4 : 3;
    if (target >= 4.5) return r < 0.65 ? 5 : r < 0.88 ? 4 : r < 0.97 ? 3 : 2;
    return r < 0.5 ? 5 : r < 0.8 ? 4 : r < 0.93 ? 3 : 2;
  };

  /** Closest available rating to the one wanted: the product's own lines first, then lines that fit anything. */
  const pick = (s: (typeof state)[number], wanted: number) => {
    const order = [wanted, wanted - 1, wanted + 1, wanted - 2].filter((n) => n >= 1 && n <= 5);
    for (const pool of [s.own, s.any]) {
      for (const st of order) {
        const options = pool.filter(([n, , text]) => n === st && !usedText.has(text));
        if (options.length) return options[Math.floor(s.rand() * options.length)];
      }
    }
    return undefined;
  };

  // Round-robin: one review per product per round, so every product gets a fair share of the lines
  for (let round = 0; state.some((s) => !s.done); round++) {
    for (const s of state) {
      if (s.done) continue;
      if (s.list.length >= s.want) {
        s.done = true;
        continue;
      }
      const entry = pick(s, stars(s.p.rating, s.rand()));
      if (!entry) {
        s.done = true;
        continue;
      }
      usedText.add(entry[2]);
      const [rating, title, text] = entry;

      // About half the reviews get a short second sentence (unused ones first)
      let body = text;
      if (s.rand() < 0.5) {
        const kind = rating >= 4 ? "good" : rating === 3 ? "ok" : "bad";
        const fresh = CLOSERS[kind].filter((c) => !usedCloser.has(c));
        const from = fresh.length ? fresh : CLOSERS[kind];
        const closer = from[Math.floor(s.rand() * from.length)];
        usedCloser.add(closer);
        body = `${text} ${closer}`;
      }

      const bought = s.inStock.length ? s.inStock[Math.floor(s.rand() * s.inStock.length)] : undefined;
      // Between launch (+2 days) and yesterday
      const days = Math.max(1, Math.floor((s.age - 3 * DAY) / DAY));
      const date = new Date(s.created + 2 * DAY + Math.floor(s.rand() * days) * DAY);
      const i = s.list.length;
      s.list.push({
        id: `${s.p.id}-r${i + 1}`,
        productId: s.p.id,
        author: s.authors[i % s.authors.length],
        rating,
        title,
        body,
        date: date.toISOString().slice(0, 10),
        verified: s.rand() > 0.15,
        helpful: Math.floor(s.rand() * s.rand() * 40),
        sizeBought: s.p.sizes.length > 1 ? bought?.size : undefined,
        colourBought: bought?.colour,
      });
    }
  }

  return new Map(state.map((s) => [s.p.id, s.list.sort((a, b) => b.date.localeCompare(a.date))]));
}

/** The average of the reviews that exist (one decimal), or the fallback when there are none. */
export function averageRating(reviews: Review[], fallback = 0) {
  if (!reviews.length) return fallback;
  return Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10;
}
