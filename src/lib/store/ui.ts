import { create } from "zustand";

export type Panel = "cart" | "wishlist" | "search" | "quiz" | "menu" | null;

/** Which overlay is open. Only one at a time, so opening one closes the others. */
interface PanelState {
  open: Panel;
  setOpen: (panel: Panel) => void;
  close: () => void;
}

export const usePanels = create<PanelState>()((set) => ({
  open: null,
  setOpen: (open) => set({ open }),
  close: () => set({ open: null }),
}));

export const openPanel = (panel: Exclude<Panel, null>) => usePanels.getState().setOpen(panel);
