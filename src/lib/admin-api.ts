/**
 * Browser client for the protected admin API (server/app.ts).
 * The server checks the httpOnly session cookie on every call; nothing secret lives here.
 */
import type { Order, OrderStatus, ProductRecord } from "@/types";

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  locale: string;
  createdAt: string;
  blocked: boolean;
  sessions: number;
  lastSeen: string | null;
  activeNow: boolean;
  orders: number;
  spent: number;
  methods: ("password" | "google")[];
};
export type AdminSession = { id: string; createdAt: string; lastSeen: string; expiresAt: string; remember: boolean; userAgent: string; ip: string; activeNow: boolean };
export type AdminCustomerDetail = AdminCustomer & {
  addresses: number;
  reviews: number;
  sessionList: AdminSession[];
  recentOrders: { id: string; status: OrderStatus; total: number; createdAt: string }[];
};

/** An order as the admin sees it (with the customer's email). */
export type AdminOrder = Order & { email: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init.body && !(init.body instanceof Blob) ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  if (!res.ok) {
    if (res.status === 401 && !url.endsWith("/login")) {
      // Session expired → back to the login page
      window.location.assign(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fields ?? {});
  }
  return data as T;
}

export const adminApi = {
  login: (username: string, password: string) =>
    call<{ ok: true }>("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => call<{ ok: true }>("/api/admin/logout", { method: "POST" }),
  session: async () => {
    const res = await fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
    return res.ok ? ((await res.json()) as { username: string; expiresAt: number }) : null;
  },
  create: (product: ProductRecord) => call<ProductRecord>("/api/admin/products", { method: "POST", body: JSON.stringify(product) }),
  update: (product: ProductRecord) => call<ProductRecord>(`/api/admin/products/${product.id}`, { method: "PUT", body: JSON.stringify(product) }),
  remove: (ids: string[]) =>
    call<{ deleted: string[] }>("/api/admin/products/delete", { method: "POST", body: JSON.stringify({ ids }) }),
  /** Undo a delete (the server keeps deleted products for 10 minutes). */
  restore: (ids: string[]) =>
    call<{ restored: string[] }>("/api/admin/products/restore", { method: "POST", body: JSON.stringify({ ids }) }),
  orders: () => call<AdminOrder[]>("/api/admin/orders"),
  /** Adds a tracking event; cancelling puts the items back in stock. */
  setOrderStatus: (id: string, status: OrderStatus) =>
    call<AdminOrder>(`/api/admin/orders/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  customers: (q = "") => call<AdminCustomer[]>(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  customer: (id: string) => call<AdminCustomerDetail>(`/api/admin/customers/${id}`),
  /** Ends every session: the customer has to sign in again everywhere. */
  signOutCustomer: (id: string) => call<{ ended: number }>(`/api/admin/customers/${id}/sign-out`, { method: "POST" }),
  endSession: (id: string, sessionId: string) => call<AdminCustomerDetail>(`/api/admin/customers/${id}/sessions/${sessionId}`, { method: "DELETE" }),
  /** Blocking also signs the customer out; they can't sign in until unblocked. */
  setBlocked: (id: string, blocked: boolean) => call<AdminCustomerDetail>(`/api/admin/customers/${id}/block`, { method: "POST", body: JSON.stringify({ blocked }) }),
  /** Only works for accounts without orders (409 "has_orders" otherwise). */
  deleteCustomer: (id: string) => call<{ deleted: string }>(`/api/admin/customers/${id}`, { method: "DELETE" }),
  upload: (file: File, slug: string) =>
    call<{ src: string; blurDataURL: string }>(
      `/api/admin/upload?slug=${encodeURIComponent(slug || "untitled")}&name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file, headers: { "Content-Type": file.type } },
    ),
};
