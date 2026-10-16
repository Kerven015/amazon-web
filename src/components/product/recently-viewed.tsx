import { useEffect, useState } from "react";
import { getProductsByIds } from "@/lib/api";
import { useRecentlyViewed } from "@/lib/store/wishlist";
import type { Product } from "@/types";
import { ProductRow } from "./product-row";
import { useT } from "@/i18n";

/** Reads recently viewed ids from the persisted store and renders a row. */
export function RecentlyViewedRow({ excludeId, fallback, max = 8 }: { excludeId?: string; fallback?: Product[]; max?: number }) {
  const ids = useRecentlyViewed((s) => s.ids);
  const t = useT("productPage");
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    getProductsByIds(ids.filter((id) => id !== excludeId).slice(0, max)).then((p) => {
      if (!cancelled) setItems(p);
    });
    return () => {
      cancelled = true;
    };
  }, [ids, excludeId, max]);

  const list = items.length ? items : (fallback ?? []);
  if (!list.length) return null;
  return <ProductRow title={items.length ? t("recentlyViewed") : t("popularNow")} products={list} />;
}

/** Drop on a product page to record the view. */
export function TrackProductView({ productId }: { productId: string }) {
  const push = useRecentlyViewed((s) => s.push);
  useEffect(() => {
    // Wait for persisted state to load so we don't overwrite it.
    const record = () => push(productId);
    if (useRecentlyViewed.persist.hasHydrated()) record();
    else return useRecentlyViewed.persist.onFinishHydration(record);
  }, [productId, push]);
  return null;
}
