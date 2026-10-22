/**
 * Browser client for the protected admin API (server/app.ts).
 * The server checks the httpOnly session cookie on every call; nothing secret lives here.
 */
import type { OrderStatus, ProductRecord } from "@/types";
// Types only (erased from the bundle): the shapes the server's admin API returns
import type { AdminOrder, AdminOrderFilter } from "../../server/lib/db/orders";
import type { InventoryRow, StockMovement, AdjustReason } from "../../server/lib/db/inventory";
import type { AdminReview, ReviewFilter } from "../../server/lib/db/reviews";
import type { AuditEntry } from "../../server/lib/db/audit";
import type { ShopSettings } from "../../server/lib/db/settings";
import type { dashboard, salesReport, ReportGroup } from "../../server/lib/db/reports";

export type { AdminOrder, AdjustReason, AdminReview, AuditEntry, InventoryRow, ReportGroup, ShopSettings, StockMovement };
export type Dashboard = Awaited<ReturnType<typeof dashboard>>;
export type SalesReport = Awaited<ReturnType<typeof salesReport>>;
export type ReportQuery = { from: string; to: string; tz: string; group?: ReportGroup };

/** "?a=1&b=2" from the values that are set */
const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string | number] => e[1] != null && e[1] !== "").map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};
/** The admin's time zone, so "today" and report days match their clock */
export const adminTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

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
  /** Ends every admin session on every device (use if an admin cookie may have leaked). */
  logoutAll: () => call<{ ended: number }>("/api/admin/logout-all", { method: "POST" }),
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
  orders: (filter: AdminOrderFilter = {}) => call<AdminOrder[]>(`/api/admin/orders${qs({ ...filter, limit: undefined })}`),
  order: (id: string) => call<AdminOrder>(`/api/admin/orders/${encodeURIComponent(id)}`),
  setShipment: (id: string, carrier: string, trackingNumber: string) =>
    call<AdminOrder>(`/api/admin/orders/${encodeURIComponent(id)}/shipment`, { method: "PATCH", body: JSON.stringify({ carrier, trackingNumber }) }),
  /** Adds a tracking event (forward only; 409 otherwise); cancelling puts the items back in stock. */
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
  dashboard: () => call<Dashboard>(`/api/admin/dashboard${qs({ tz: adminTimeZone() })}`),
  inventory: () => call<{ threshold: number; rows: InventoryRow[] }>("/api/admin/inventory"),
  movements: (productId?: string, before?: number) => call<StockMovement[]>(`/api/admin/inventory/movements${qs({ productId, before })}`),
  adjustStock: (body: { productId: string; size: string; colour: string; change: number; reason: AdjustReason; note: string }) =>
    call<{ quantity: number }>("/api/admin/inventory/adjust", { method: "POST", body: JSON.stringify(body) }),
  settings: () => call<ShopSettings>("/api/admin/settings"),
  saveSettings: (settings: ShopSettings) => call<ShopSettings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) }),
  reviews: (filter: ReviewFilter = {}) => call<AdminReview[]>(`/api/admin/reviews${qs({ ...filter, limit: undefined })}`),
  setReviewHidden: (id: string, hidden: boolean) => call<{ id: string; hidden: boolean }>(`/api/admin/reviews/${encodeURIComponent(id)}/hide`, { method: "POST", body: JSON.stringify({ hidden }) }),
  deleteReview: (id: string) => call<{ deleted: string }>(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: "DELETE" }),
  salesReport: (q: ReportQuery) => call<SalesReport>(`/api/admin/reports/sales${qs(q)}`),
  /** A link the browser downloads (the session cookie goes with it) */
  exportUrl: (type: "orders" | "products", q: ReportQuery) => `/api/admin/reports/export${qs({ type, from: q.from, to: q.to, tz: q.tz })}`,
  activity: (filter: { entityType?: string; entityId?: string; before?: number } = {}) => call<AuditEntry[]>(`/api/admin/activity${qs(filter)}`),
  upload: (file: File, slug: string) =>
    call<{ src: string; blurDataURL: string }>(
      `/api/admin/upload?slug=${encodeURIComponent(slug || "untitled")}&name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file, headers: { "Content-Type": file.type } },
    ),
};
