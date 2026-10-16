import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Order } from "@/types";

/** Orders placed in this browser via the mock checkout. */
interface PlacedOrdersState {
  orders: Order[];
  add: (order: Order) => void;
}

export const usePlacedOrders = create<PlacedOrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      add: (order) => set({ orders: [order, ...get().orders].slice(0, 20) }),
    }),
    { name: "vendora-placed-orders", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

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
