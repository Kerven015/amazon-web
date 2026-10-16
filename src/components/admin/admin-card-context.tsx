import { createContext, useContext } from "react";
import type { Product } from "@/types";

/**
 * When provided (admin catalog), the public ProductCard switches to admin mode:
 * the card opens the edit page, and shows Edit / Delete buttons and a checkbox.
 */
export type AdminCardApi = {
  selected: Set<string>;
  toggle: (id: string) => void;
  editHref: (product: Product) => string;
  remove: (product: Product) => void;
};

const AdminCardContext = createContext<AdminCardApi | null>(null);
export const AdminCardProvider = AdminCardContext.Provider;
export const useAdminCard = () => useContext(AdminCardContext);
