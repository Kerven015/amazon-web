import { create } from "zustand";
import { persist } from "zustand/middleware";
import { accountApi } from "@/lib/account-api";
import { guestStorage, isSignedIn } from "@/lib/session-state";
import type { Address } from "@/types";

/**
 * The shopper's address book. Signed in, every change goes to the account
 * (/api/account/addresses) and the store shows the list the server sends back;
 * signed out, it's kept in this browser (and merged into the account on sign-in).
 * Actions are async because the account needs a round trip; they throw AccountApiError.
 */
interface AddressBookState {
  addresses: Address[];
  add: (address: Omit<Address, "id">, makeDefault?: boolean) => Promise<Address>;
  update: (id: string, patch: Partial<Omit<Address, "id">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
}

const withDefault = (list: Address[], id?: string) => {
  const target = id ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id;
  return list.map((a) => ({ ...a, isDefault: a.id === target }));
};

export const useAddressBook = create<AddressBookState>()(
  persist(
    (set, get) => ({
      addresses: [],
      add: async (address, makeDefault = false) => {
        if (isSignedIn()) {
          const { address: created, addresses } = await accountApi.addAddress({ ...address, isDefault: makeDefault });
          set({ addresses });
          return created;
        }
        const created: Address = { ...address, id: `a-${Date.now().toString(36)}` };
        const list = [...get().addresses, created];
        set({ addresses: withDefault(list, makeDefault || list.length === 1 ? created.id : undefined) });
        return created;
      },
      update: async (id, patch) => {
        if (isSignedIn()) return void set({ addresses: (await accountApi.updateAddress(id, patch)).addresses });
        set({ addresses: get().addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
      },
      remove: async (id) => {
        if (isSignedIn()) return void set({ addresses: (await accountApi.removeAddress(id)).addresses });
        set({ addresses: withDefault(get().addresses.filter((a) => a.id !== id)) });
      },
      setDefault: async (id) => {
        if (isSignedIn()) return void set({ addresses: (await accountApi.setDefaultAddress(id)).addresses });
        set({ addresses: withDefault(get().addresses, id) });
      },
    }),
    { name: "vendora-addresses", storage: guestStorage, skipHydration: true },
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
