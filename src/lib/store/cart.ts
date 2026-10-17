import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem, Product, SelectedVariant } from "@/types";
import { computeTotals, discountAmount } from "@/lib/pricing";
import { colorImage, priceFor, stockFor } from "@/lib/product-utils";
import { getSellerName } from "@/lib/store/helpers";
import { isSignedIn } from "@/lib/session-state";

export function lineIdFor(productId: string, variant: SelectedVariant) {
  return [productId, variant.size ?? "", variant.color ?? ""].join("|");
}

export function toCartItem(product: Product, variant: SelectedVariant, quantity = 1): CartItem {
  const { price, listPrice } = priceFor(product, variant);
  const photo = colorImage(product, variant.color);
  return {
    lineId: lineIdFor(product.id, variant),
    productId: product.id,
    title: product.title,
    image: photo.src,
    imageBlur: photo.blurDataURL,
    price,
    listPrice,
    quantity,
    stock: stockFor(product, variant.color, variant.size),
    variant,
    sellerName: getSellerName(product.sellerId),
    fastDelivery: product.fastDelivery,
  };
}

interface CartState {
  items: CartItem[];
  saved: CartItem[];
  /** Applied discount code (validated against siteConfig.discountCodes) */
  discountCode: string | null;
  setDiscountCode: (code: string | null) => void;
  addItem: (item: CartItem) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  saveForLater: (lineId: string) => void;
  moveToCart: (lineId: string) => void;
  removeSaved: (lineId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      saved: [],
      discountCode: null,
      setDiscountCode: (discountCode) => set({ discountCode }),
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.lineId === item.lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === item.lineId
                  ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock, 10) }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      removeItem: (lineId) => set((s) => ({ items: s.items.filter((i) => i.lineId !== lineId) })),
      setQuantity: (lineId, quantity) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.lineId === lineId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock, 10)) } : i,
          ),
        })),
      saveForLater: (lineId) =>
        set((s) => {
          const item = s.items.find((i) => i.lineId === lineId);
          if (!item) return s;
          return {
            items: s.items.filter((i) => i.lineId !== lineId),
            saved: [item, ...s.saved.filter((i) => i.lineId !== lineId)],
          };
        }),
      moveToCart: (lineId) =>
        set((s) => {
          const item = s.saved.find((i) => i.lineId === lineId);
          if (!item) return s;
          return {
            saved: s.saved.filter((i) => i.lineId !== lineId),
            items: [...s.items.filter((i) => i.lineId !== lineId), item],
          };
        }),
      removeSaved: (lineId) => set((s) => ({ saved: s.saved.filter((i) => i.lineId !== lineId) })),
      clear: () => set({ items: [], discountCode: null }),
    }),
    {
      name: "vendora-cart",
      storage: createJSONStorage(() => localStorage),
      // Signed in, the bag lives in the account (lib/session.ts); only "saved for later" and the code stay here
      partialize: (s) => (isSignedIn() ? { saved: s.saved, discountCode: s.discountCode } : { items: s.items, saved: s.saved, discountCode: s.discountCode }),
      // Rehydrated manually in <Providers> to avoid SSR hydration mismatches.
      skipHydration: true,
    },
  ),
);

/* ------------------------------ Selectors ----------------------------- */

export const selectCount = (s: CartState) => s.items.reduce((n, i) => n + i.quantity, 0);
export const selectSubtotal = (s: CartState) => s.items.reduce((n, i) => n + i.price * i.quantity, 0);
export const selectSavings = (s: CartState) =>
  s.items.reduce((n, i) => n + Math.max(0, (i.listPrice ?? i.price) - i.price) * i.quantity, 0);

export const selectDiscount = (s: CartState) => discountAmount(selectSubtotal(s), s.discountCode);

export { computeTotals };
