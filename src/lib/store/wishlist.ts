import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { guestStorage } from "@/lib/session-state";

/**
 * A product a signed-out shopper tried to save. The wishlist needs an account, so they're
 * sent to sign in; once they have, lib/session.ts saves it for them (sessionStorage = this tab only).
 */
const PENDING_KEY = "vendora-pending-save";
export function setPendingSave(id: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, id);
  } catch {
    /* storage blocked: they'll just save it again after signing in */
  }
}
export function takePendingSave(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Saved products — signed-in customers only; the list lives in the account (lib/session.ts keeps it in sync). */
interface WishlistState {
  ids: string[];
  toggle: (id: string) => boolean; // returns true if now saved
  remove: (id: string) => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const has = get().ids.includes(id);
        set({ ids: has ? get().ids.filter((x) => x !== id) : [id, ...get().ids] });
        return !has;
      },
      remove: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
    }),
    { name: "vendora-wishlist", storage: guestStorage, skipHydration: true },
  ),
);

interface RecentlyViewedState {
  ids: string[];
  push: (id: string) => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      ids: [],
      push: (id) => set({ ids: [id, ...get().ids.filter((x) => x !== id)].slice(0, 9) }),
    }),
    { name: "vendora-recent", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
