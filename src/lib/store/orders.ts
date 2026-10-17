import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** UI preferences (not persisted to the server). */
interface UiState {
  deliveryLocation: string;
  setDeliveryLocation: (v: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      deliveryLocation: "Portland 97205",
      setDeliveryLocation: (deliveryLocation) => set({ deliveryLocation }),
    }),
    { name: "vendora-ui", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
