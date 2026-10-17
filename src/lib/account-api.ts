/**
 * Browser client for the customer API (server/shop-api.ts).
 * The session lives in an httpOnly cookie; nothing secret is kept here.
 * Errors come back as codes (AccountApiError.code) that the UI shows as
 * translated messages (messages → accountErrors.{code}).
 */
import { rawMessage, translate } from "@/i18n";
import type { ApiErrorCode } from "@/lib/account-schema";
import type { Address, Order } from "@/types";

export type SessionUser = { id: string; name: string; email: string; locale: string };
export type Profile = SessionUser & { memberSince: string };
export type CartLine = { productId: string; size?: string; colour?: string; quantity: number };
export type OutOfStockLine = CartLine & { requested: number; available: number };

export class AccountApiError extends Error {
  constructor(
    public code: ApiErrorCode | "network",
    public status: number,
    public fields: Record<string, string> = {},
    public lines: OutOfStockLine[] = [],
  ) {
    super(code);
  }
}

async function call<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new AccountApiError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string>; lines?: OutOfStockLine[] };
  if (!res.ok) throw new AccountApiError((data.error as ApiErrorCode) ?? "server_error", res.status, data.fields ?? {}, data.lines ?? []);
  return data as T;
}

export const accountApi = {
  /* auth */
  me: async (): Promise<SessionUser | null> => {
    try {
      return await call<SessionUser>("/api/auth/me");
    } catch (err) {
      if (err instanceof AccountApiError && err.status === 401) return null;
      throw err;
    }
  },
  register: (body: { name: string; email: string; password: string; locale: string }) => call<{ user: SessionUser }>("/api/auth/register", { method: "POST", json: body }),
  login: (body: { email: string; password: string; remember: boolean }) => call<{ user: SessionUser }>("/api/auth/login", { method: "POST", json: body }),
  logout: () => call<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  logoutAll: () => call<{ ok: true }>("/api/auth/logout-all", { method: "POST" }),

  /* profile */
  profile: () => call<Profile>("/api/account/profile"),
  updateProfile: (body: { name?: string; email?: string; locale?: string; currentPassword?: string }) => call<Profile>("/api/account/profile", { method: "PATCH", json: body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) => call<{ ok: true }>("/api/account/password", { method: "POST", json: body }),

  /* bag */
  cart: () => call<{ items: CartLine[] }>("/api/account/cart"),
  saveCart: (items: CartLine[], mode: "replace" | "merge" = "replace") => call<{ items: CartLine[] }>("/api/account/cart", { method: "PUT", json: { items, mode } }),

  /* addresses — every change returns the whole (updated) list */
  addresses: () => call<{ addresses: Address[] }>("/api/account/addresses"),
  addAddress: (a: Omit<Address, "id">, opts: { dedupe?: boolean } = {}) =>
    call<{ address: Address; addresses: Address[] }>(`/api/account/addresses${opts.dedupe ? "?dedupe=1" : ""}`, { method: "POST", json: a }),
  updateAddress: (id: string, patch: Partial<Omit<Address, "id">>) => call<{ address: Address; addresses: Address[] }>(`/api/account/addresses/${id}`, { method: "PATCH", json: patch }),
  removeAddress: (id: string) => call<{ addresses: Address[] }>(`/api/account/addresses/${id}`, { method: "DELETE" }),
  setDefaultAddress: (id: string) => call<{ addresses: Address[] }>(`/api/account/addresses/${id}/default`, { method: "POST" }),

  /* wishlist */
  wishlist: () => call<{ ids: string[] }>("/api/account/wishlist"),
  saveWishlist: (ids: string[], mode: "replace" | "merge" = "replace") => call<{ ids: string[] }>("/api/account/wishlist", { method: "PUT", json: { ids, mode } }),

  /* orders */
  orders: () => call<{ orders: Order[] }>("/api/account/orders"),
  order: async (id: string): Promise<Order | null> => {
    try {
      return await call<Order>(`/api/orders/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof AccountApiError && (err.status === 404 || err.status === 401)) return null;
      throw err;
    }
  },
  placeOrder: (body: {
    items: CartLine[];
    addressId?: string;
    address?: Omit<Address, "id" | "isDefault">;
    deliveryOption: string;
    discountCode?: string;
    payment: { method: "card" | "wallet"; last4?: string };
  }) => call<Order>("/api/orders", { method: "POST", json: body }),

  /* reviews */
  myReviews: () => call<{ reviews: { id: string; productId: string }[] }>("/api/account/reviews"),
  addReview: (productId: string, body: { rating: number; title: string; body: string; author?: string }) =>
    call<{ id: string; productId: string }>(`/api/products/${encodeURIComponent(productId)}/reviews`, { method: "POST", json: body }),
};

/** An API error (or an error code) → a message in the current language (messages → accountErrors.*). */
export function accountErrorMessage(err: unknown): string {
  const code = err instanceof AccountApiError ? err.code : typeof err === "string" ? err : "server_error";
  return rawMessage(`accountErrors.${code}`) !== undefined ? translate(`accountErrors.${code}`) : translate("accountErrors.server_error");
}
