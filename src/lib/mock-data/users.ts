import type { Address, User } from "@/types";

export const addresses: Address[] = [
  { id: "a1", label: "home", fullName: "Alex Morgan", line1: "742 Evergreen Terrace", line2: "Apt 3B", city: "Springfield", region: "OR", postalCode: "97477", country: "US", phone: "+1 (555) 014-2290", isDefault: true },
  { id: "a2", label: "work", fullName: "Alex Morgan", line1: "1200 Market Street", line2: "Floor 9", city: "Portland", region: "OR", postalCode: "97205", country: "US", phone: "+1 (555) 014-7781" },
];

export const currentUser: User = {
  id: "u1",
  name: "Alex Morgan",
  email: "alex@example.com",
  memberSince: "2023-03-14",
  addresses,
};
