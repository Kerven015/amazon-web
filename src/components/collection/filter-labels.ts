import { useMemo } from "react";
import { useT } from "@/i18n";
import type { Product } from "@/types";
import type { MultiKey } from "./query-state";

/**
 * Translated labels for filter groups and their values. Filter values in the URL
 * stay in English (so a shared link works in every language); only labels change.
 */
export function useFilterLabels(products: Product[]) {
  const t = useT();
  const materials = useMemo(() => new Map(products.map((p) => [p.materialKey ?? p.material, p.material])), [products]);

  return useMemo(() => {
    const dict = (ns: string, value: string) => (t.has(`${ns}.${value}`) ? t(`${ns}.${value}`) : value);
    const value = (key: MultiKey, v: string): string => {
      switch (key) {
        case "type":
          return dict("productTypes", v);
        case "feel":
          return dict("feels", v);
        case "material":
          return materials.get(v) ?? v;
        case "colour":
          return dict("colourFamilies", v);
        case "size":
          return dict("sizes", v);
        case "gsm":
          return dict("filters.gsm", v);
        case "design":
          return dict("designs", v);
        default:
          return v;
      }
    };
    return { group: (key: MultiKey | "price" | "availability") => t(`filters.groups.${key}`), value };
  }, [t, materials]);
}
