import { photo } from "@/lib/images";
import type { Category } from "@/types";

const img = (seed: string) => photo(`vd-cat-${seed}`, 800, 1000);

export const categories: Category[] = [
  { id: "c9", slug: "towels", name: "Towels & Bath", icon: "bath", image: img("towels"), blurb: "Bath, beach, baby & robes" },
];
