/**
 * Browser client for the protected admin API (server/app.ts).
 * The server checks the httpOnly session cookie on every call; nothing secret lives here.
 */
import type { ProductRecord } from "@/types";

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
  upload: (file: File, slug: string) =>
    call<{ src: string; blurDataURL: string }>(
      `/api/admin/upload?slug=${encodeURIComponent(slug || "untitled")}&name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file, headers: { "Content-Type": file.type } },
    ),
};
