import type { Product } from "@/types";

/**
 * Towel collections served at /collections/[slug].
 * Each collection is a title, a short intro and a rule over the catalogue.
 * TODO(backend): collections become CMS/API records with server-side filters.
 */
export interface CollectionDef {
  slug: string;
  title: string;
  intro: string;
  match: (p: Product) => boolean;
}

const TOWEL_TYPES = [
  "Towels",
  "Bath Towels",
  "Beach Towels",
  "Baby Towels",
  "Kitchen Towels",
  "Bath Mats",
  "Bathrobes",
  "Towel Bundles",
];

export const isTowel = (p: Product) => p.categorySlug === "towels" || TOWEL_TYPES.includes(p.productType);
const ofType = (...types: string[]) => (p: Product) => types.includes(p.productType);
const inCollection = (slug: string) => (p: Product) => !!p.collections?.includes(slug);
const hasSize = (size: string) => (p: Product) => isTowel(p) && !!p.variants.sizes?.includes(size);
const onSale = (p: Product) => !!p.listPrice && p.listPrice > p.price;

export const collections: CollectionDef[] = [
  { slug: "all-towels", title: "All towels", intro: "Every towel we make, from featherlight waffle to deep hotel plush.", match: isTowel },
  { slug: "towel-bundles", title: "Towel bundles", intro: "Matching sets for the whole bathroom, at a better price than buying singles.", match: ofType("Towel Bundles") },
  { slug: "bath-towels", title: "Bath towels", intro: "The everyday essential, in every weight and every calm colour.", match: (p) => ofType("Bath Towels", "Towels")(p) || hasSize("Bath towel")(p) },
  { slug: "beach-towels", title: "Beach towels", intro: "Oversized, quick-drying and made for long days in the sun.", match: ofType("Beach Towels") },
  { slug: "baby-towels", title: "Baby towels", intro: "Gentle organic cotton for the smallest bath-time fans.", match: ofType("Baby Towels") },
  { slug: "kitchen-towels", title: "Kitchen towels", intro: "Lint-free linen and quick-dry waffle for busy kitchens.", match: ofType("Kitchen Towels") },
  { slug: "bath-mats-rugs", title: "Bath mats & rugs", intro: "Soft, absorbent and kind to bare feet.", match: ofType("Bath Mats") },
  { slug: "bath-robes", title: "Bath robes", intro: "From featherlight waffle to deep shawl-collar plush.", match: ofType("Bathrobes") },
  { slug: "towel-offers", title: "Towel offers", intro: "Limited-time prices on bath favourites.", match: (p) => isTowel(p) && onSale(p) },
  { slug: "personalised-towels", title: "Personalised towels", intro: "Add initials in a choice of thread colours — free on selected styles.", match: (p) => !!p.personalisable },
  { slug: "luxury", title: "Luxury", intro: "Our heaviest, softest weaves for a hotel feeling at home.", match: inCollection("luxury") },
  { slug: "design-patterned", title: "Design & patterned", intro: "Stripes, jacquards and texture for a bathroom with character.", match: (p) => inCollection("design-patterned")(p) || (isTowel(p) && p.design === "Patterned") },
  { slug: "quick-drying", title: "Quick drying", intro: "Lighter weaves that dry fast and pack small.", match: inCollection("quick-drying") },
  { slug: "elevated-classics", title: "Elevated classics", intro: "Timeless plain towels, made better.", match: inCollection("elevated-classics") },
  { slug: "wellness-spa", title: "Wellness & spa", intro: "Robes, ribbed towels and slow rituals for a spa day at home.", match: inCollection("wellness-spa") },
  { slug: "face-cloths", title: "Face cloths", intro: "Small, soft and endlessly useful.", match: hasSize("Face cloth") },
  { slug: "hand-towels", title: "Hand towels", intro: "For the basin, the guest loo and the gym bag.", match: hasSize("Hand towel") },
  { slug: "bath-sheets", title: "Bath sheets", intro: "Our largest size — generous enough to wrap right round.", match: hasSize("Bath sheet") },
  {
    slug: "gifting",
    title: "Gifting",
    intro: "Bundles, personalised pieces and baby gifts, wrapped and ready.",
    match: (p) => ofType("Towel Bundles", "Baby Towels")(p) || !!p.personalisable,
  },
];

export function getCollectionDef(slug: string) {
  return collections.find((c) => c.slug === slug) ?? null;
}
