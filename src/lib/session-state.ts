/**
 * Who's signed in — kept apart from lib/session.ts so the stores can read it
 * without importing the sync code (which imports the stores).
 */
import { create } from "zustand";
import { createJSONStorage } from "zustand/middleware";
import type { SessionUser } from "@/lib/account-api";

type Status = "unknown" | "signedIn" | "signedOut";

export const useSession = create<{ status: Status; user: SessionUser | null }>()(() => ({ status: "unknown", user: null }));

export const isSignedIn = () => useSession.getState().status === "signedIn";

/**
 * localStorage that stops writing while a customer is signed in (their data then lives
 * in the account). Used by the wishlist and the address book.
 */
export const guestStorage = createJSONStorage(() => ({
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (!isSignedIn()) localStorage.setItem(key, value);
  },
  removeItem: (key: string) => localStorage.removeItem(key),
}));
