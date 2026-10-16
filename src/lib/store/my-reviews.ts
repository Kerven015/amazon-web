import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Review } from "@/types";

/** Reviews the shopper wrote in this browser (until reviews go to the server). */
interface MyReviewsState {
  reviews: Review[];
  add: (review: Review) => void;
}

export const useMyReviews = create<MyReviewsState>()(
  persist(
    (set, get) => ({
      reviews: [],
      add: (review) => set({ reviews: [review, ...get().reviews].slice(0, 100) }),
    }),
    { name: "vendora-my-reviews", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
