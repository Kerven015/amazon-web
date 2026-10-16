/**
 * Editorial photo slots (hero, collection tiles, quiz banner, newsletter popup).
 *
 * `npm run images:fetch` downloads one Pexels photo per slot into
 * public/images/editorial/{file}.webp at exactly width × height, and records
 * it in src/lib/mock-data/editorial-manifest.json. photo() (lib/images.ts)
 * serves the file when it's in the manifest, and draws an illustration otherwise.
 * Shared by the browser and the Node script, so keep it free of "@/" imports.
 */
export type EditorialSlot = {
  seed: string;
  file: string;
  width: number;
  height: number;
  query: string;
  orientation: "landscape" | "portrait" | "square";
};

const hero = (key: string, query: string): EditorialSlot => ({ seed: `vd-hero-${key}`, file: `hero-${key}`, width: 1800, height: 1000, query, orientation: "landscape" });
const tile = (slug: string, query: string): EditorialSlot => ({ seed: `vd-col-${slug}`, file: `collection-${slug}`, width: 900, height: 720, query, orientation: "landscape" });

export const editorialSlots: EditorialSlot[] = [
  hero("bath", "folded white towels bathroom"),
  hero("beach", "beach towel on sand"),
  hero("spa", "spa towels stones"),
  tile("bath-towels", "stack of bath towels"),
  tile("beach-towels", "striped beach towel"),
  tile("baby-towels", "baby hooded towel"),
  tile("kitchen-towels", "kitchen tea towel"),
  tile("bath-mats-rugs", "bath mat bathroom floor"),
  tile("bath-robes", "bathrobe hanging"),
  { seed: "vd-quiz-banner", file: "quiz-banner", width: 1000, height: 800, query: "soft towels basket", orientation: "landscape" },
  { seed: "vd-newsletter", file: "newsletter", width: 700, height: 900, query: "rolled towels spa", orientation: "portrait" },
];

export type EditorialEntry = { src: string; blurDataURL?: string };
