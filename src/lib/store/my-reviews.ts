import { create } from "zustand";

/** Ids of the reviews the signed-in customer wrote (loaded from the account; marks "Your review"). */
interface MyReviewsState {
  ids: string[];
  add: (id: string) => void;
}

export const useMyReviews = create<MyReviewsState>()((set, get) => ({
  ids: [],
  add: (id) => set({ ids: [id, ...get().ids] }),
}));
