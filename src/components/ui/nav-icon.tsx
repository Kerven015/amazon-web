import {
  Baby,
  Bath,
  Droplets,
  Footprints,
  Gift,
  Hand,
  Heart,
  House,
  LayoutGrid,
  Leaf,
  type LucideIcon,
  Maximize2,
  Package,
  Palette,
  PenLine,
  Shirt,
  ShowerHead,
  Sparkles,
  Tag,
  TreePalm,
  UtensilsCrossed,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Every navigation icon, in one place. lib/navigation.ts refers to these by key
 * (`icon: "bath"`), and the mega menu, mobile drawer, collection chips, home tiles
 * and admin all render them through <NavIcon>.
 */
export const navIcons = {
  // Shop By Category
  allTowels: LayoutGrid,
  bundles: Gift,
  bath: Bath,
  beach: TreePalm,
  baby: Baby,
  kitchen: UtensilsCrossed,
  bathMats: Footprints,
  robes: Shirt,
  offers: Tag,
  personalised: PenLine,
  // Shop By Collection
  luxury: Sparkles,
  patterned: Palette,
  quickDry: Wind,
  classics: Heart,
  wellness: Leaf,
  // Shop By Size
  faceCloth: Droplets,
  handTowel: Hand,
  bathTowel: ShowerHead,
  bathSheet: Maximize2,
  // Other
  home: House,
  allProducts: Package,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof navIcons;

/**
 * Single-colour line icon in the icon token (--color-icon: navy in light mode,
 * a lighter blue in dark mode). Decorative: always aria-hidden.
 */
export function NavIcon({ name, size = 16, className }: { name: NavIconName; size?: number; className?: string }) {
  const Icon = navIcons[name];
  return <Icon aria-hidden="true" focusable="false" width={size} height={size} strokeWidth={1.5} className={cn("nav-icon shrink-0", className)} />;
}
