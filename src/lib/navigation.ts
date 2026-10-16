import type { NavIconName } from "@/components/ui/nav-icon";
/**
 * Main navigation — edit links here without touching components.
 * Items with `groups` open a panel (desktop) / accordion (mobile).
 * Collection links point at /collections/[slug] (see lib/collections.ts).
 * `icon` (a key of components/ui/nav-icon.tsx) is shown before the label in the
 * mega menu, mobile drawer and collection quick-filter chips — this file is the only list.
 *
 * Labels are translated: `key` points into messages/{en,tr,tk}.json →
 * megaMenu.items / megaMenu.groups / megaMenu.links. `label` is the English
 * name (used by the admin and as a fallback).
 */

export type NavLink = {
  /** messages → megaMenu.links.{key} */
  key: string;
  label: string;
  href: string;
  /** Line icon before the label (mega menu, mobile drawer, collection chips) */
  icon?: NavIconName;
};
/** `key` → messages megaMenu.groups.{key} */
export type NavGroup = { key: string; heading: string; links: NavLink[] };
/** `id` → messages megaMenu.items.{id} */
export type NavItem = {
  id: string;
  label: string;
  /** Where the item goes when it has no panel (and the "View all" link on mobile) */
  href: string;
  groups?: NavGroup[];
};

const c = (slug: string) => `/collections/${slug}`;

export const mainNav: NavItem[] = [
  {
    id: "towels",
    label: "Towels",
    href: c("all-towels"),
    groups: [
      {
        key: "byCategory", heading: "Shop by category",
        links: [
          { key: "allTowels", label: "All towels", href: c("all-towels"), icon: "allTowels" },
          { key: "towelBundles", label: "Towel bundles", href: c("towel-bundles"), icon: "bundles" },
          { key: "bathTowels", label: "Bath towels", href: c("bath-towels"), icon: "bath" },
          { key: "beachTowels", label: "Beach towels", href: c("beach-towels"), icon: "beach" },
          { key: "babyTowels", label: "Baby towels", href: c("baby-towels"), icon: "baby" },
          { key: "kitchenTowels", label: "Kitchen towels", href: c("kitchen-towels"), icon: "kitchen" },
          { key: "bathMatsAndRugs", label: "Bath mats & rugs", href: c("bath-mats-rugs"), icon: "bathMats" },
          { key: "bathRobes", label: "Bath robes", href: c("bath-robes"), icon: "robes" },
          { key: "towelOffers", label: "Towel offers", href: c("towel-offers"), icon: "offers" },
          { key: "personalisedTowels", label: "Personalised towels", href: c("personalised-towels"), icon: "personalised" },
        ],
      },
      {
        key: "byCollection", heading: "Shop by collection",
        links: [
          { key: "luxury", label: "Luxury", href: c("luxury"), icon: "luxury" },
          { key: "designAndPatterned", label: "Design & patterned", href: c("design-patterned"), icon: "patterned" },
          { key: "quickDrying", label: "Quick drying", href: c("quick-drying"), icon: "quickDry" },
          { key: "elevatedClassics", label: "Elevated classics", href: c("elevated-classics"), icon: "classics" },
          { key: "wellnessAndSpa", label: "Wellness & spa", href: c("wellness-spa"), icon: "wellness" },
        ],
      },
      {
        key: "bySize", heading: "Shop by size",
        links: [
          { key: "faceCloths", label: "Face cloths", href: c("face-cloths"), icon: "faceCloth" },
          { key: "handTowels", label: "Hand towels", href: c("hand-towels"), icon: "handTowel" },
          { key: "bathTowels", label: "Bath towels", href: c("bath-towels"), icon: "bathTowel" },
          { key: "bathSheets", label: "Bath sheets", href: c("bath-sheets"), icon: "bathSheet" },
        ],
      },
    ],
  },
  { id: "bundles", label: "Bundles", href: c("towel-bundles") },
  { id: "bath-mats", label: "Bath mats", href: c("bath-mats-rugs") },
  { id: "bathrobes", label: "Bathrobes", href: c("bath-robes") },
  { id: "sale", label: "Sale", href: c("towel-offers") },
  {
    id: "gifting",
    label: "Gifting",
    href: c("gifting"),
    groups: [
      {
        key: "giftIdeas", heading: "Gift ideas",
        links: [
          { key: "allGifts", label: "All gifts", href: c("gifting") },
          { key: "giftBundles", label: "Gift bundles", href: c("towel-bundles") },
          { key: "personalisedTowels", label: "Personalised towels", href: c("personalised-towels") },
          { key: "babyGifts", label: "Baby gifts", href: c("baby-towels") },
          { key: "spaGifts", label: "Spa gifts", href: c("wellness-spa") },
        ],
      },
      {
        key: "byPrice", heading: "Shop by price",
        links: [
          { key: "under25", label: "Under $25", href: `${c("gifting")}?max=25` },
          { key: "under50", label: "Under $50", href: `${c("gifting")}?max=50` },
          { key: "under100", label: "Under $100", href: `${c("gifting")}?max=100` },
        ],
      },
    ],
  },
  { id: "about", label: "About us", href: "/help/about" },
];

/** Product type → the matching "Shop By Category" collection (icon, breadcrumb, translations). */
export const typeCollection: Record<string, string> = {
  "Bath Towels": "bath-towels",
  "Beach Towels": "beach-towels",
  "Baby Towels": "baby-towels",
  "Kitchen Towels": "kitchen-towels",
  "Bath Mats": "bath-mats-rugs",
  Bathrobes: "bath-robes",
  "Towel Bundles": "towel-bundles",
  Towels: "all-towels",
};

/** Icon for a product type or a collection slug, read from the menu above ("Bath Towels" → "bath"). */
export function iconFor(typeOrSlug: string): NavIconName | undefined {
  const slug = typeCollection[typeOrSlug] ?? typeOrSlug;
  for (const item of mainNav)
    for (const group of item.groups ?? [])
      for (const link of group.links) if (link.icon && link.href === `/collections/${slug}`) return link.icon;
  return undefined;
}
