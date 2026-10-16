import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { currentUser } from "@/lib/mock-data/users";

/** Name and email shown on the account page (kept in this browser). TODO(backend): save to the account. */
interface ProfileState {
  name: string;
  email: string;
  update: (patch: Partial<Pick<ProfileState, "name" | "email">>) => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      name: currentUser.name,
      email: currentUser.email,
      update: (patch) => set(patch),
    }),
    { name: "vendora-profile", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
