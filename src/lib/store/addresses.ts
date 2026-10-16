import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addresses as seed } from "@/lib/mock-data/users";
import type { Address } from "@/types";

/**
 * The shopper's address book (kept in this browser until there's a backend).
 * Starts with the mock addresses; checkout and the account page add and edit it.
 * TODO(backend): load from and save to the user's account.
 */
interface AddressBookState {
  addresses: Address[];
  add: (address: Omit<Address, "id">, makeDefault?: boolean) => Address;
  update: (id: string, patch: Partial<Omit<Address, "id">>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
}

const withDefault = (list: Address[], id?: string) => {
  const target = id ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id;
  return list.map((a) => ({ ...a, isDefault: a.id === target }));
};

export const useAddressBook = create<AddressBookState>()(
  persist(
    (set, get) => ({
      addresses: seed,
      add: (address, makeDefault = false) => {
        const created: Address = { ...address, id: `a-${Date.now().toString(36)}` };
        const list = [...get().addresses, created];
        set({ addresses: withDefault(list, makeDefault || list.length === 1 ? created.id : undefined) });
        return created;
      },
      update: (id, patch) => set({ addresses: get().addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
      remove: (id) => set({ addresses: withDefault(get().addresses.filter((a) => a.id !== id)) }),
      setDefault: (id) => set({ addresses: withDefault(get().addresses, id) }),
    }),
    { name: "vendora-addresses", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

/** A blank address in the first country we deliver to. */
export const emptyAddress = (country: string): Omit<Address, "id"> => ({
  label: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country,
  phone: "",
});

export type AddressField = "fullName" | "line1" | "city" | "region" | "postalCode" | "phone" | "country";

/** Required fields + a loose phone check (7+ digits). Returns field → message key (checkout.errors.*). */
export function validateAddress(a: Omit<Address, "id">): Partial<Record<AddressField, string>> {
  const errors: Partial<Record<AddressField, string>> = {};
  for (const f of ["fullName", "line1", "city", "region", "postalCode", "phone", "country"] as const) {
    if (!String(a[f] ?? "").trim()) errors[f] = "required";
  }
  if (!errors.phone && a.phone.replace(/\D/g, "").length < 7) errors.phone = "phone";
  return errors;
}
