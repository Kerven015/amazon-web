import { useState } from "react";
import { useLoaderData } from "react-router";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { statusMeta } from "@/components/account/account-view";
import { formatDate, formatPrice, useLocale, useT } from "@/i18n";
import { type AdminOrder, adminApi, ApiError } from "@/lib/admin-api";
import type { OrderStatus } from "@/types";

const STATUSES: OrderStatus[] = ["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"];

export async function adminOrdersLoader() {
  return { orders: await adminApi.orders() };
}

/** /admin/orders — every order, newest first; changing the status adds a tracking event. */
export default function AdminOrdersPage() {
  const t = useT("admin.orders");
  const ts = useT("orders.status");
  const locale = useLocale();
  const [orders, setOrders] = useState<AdminOrder[]>(useLoaderData<typeof adminOrdersLoader>().orders);
  const [busy, setBusy] = useState<string | null>(null);

  const change = async (order: AdminOrder, status: OrderStatus) => {
    if (status === order.status) return;
    if (status === "cancelled" && !window.confirm(t("confirmCancel", { id: order.id }))) return;
    setBusy(order.id);
    try {
      const updated = await adminApi.setOrderStatus(order.id, status);
      setOrders((list) => list.map((o) => (o.id === order.id ? updated : o)));
      toast.success(t("updated", { id: order.id, status: ts(status) }));
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 409 ? t("cancelledLocked") : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("count", { count: orders.length })}</p>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-sm border bg-card p-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("order")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("placed")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("customer")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("items")}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t("total")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{o.id}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(o.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }, locale)}</td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{o.customerName}</span>
                    <span className="block text-xs text-muted-foreground">{o.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5">
                      {o.items.map((i) => (
                        <li key={`${i.productId}|${i.variant?.size ?? ""}|${i.variant?.color ?? ""}`}>
                          {i.quantity} × {i.title}
                          {(i.variant?.size || i.variant?.color) && <span className="text-muted-foreground"> · {[i.variant.size, i.variant.color].filter(Boolean).join(", ")}</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="price whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(o.total, locale)}</td>
                  <td className="px-4 py-3">
                    {o.status === "cancelled" ? (
                      <Badge variant={statusMeta.cancelled.variant}>{ts("cancelled")}</Badge>
                    ) : (
                      <Select aria-label={t("statusFor", { id: o.id })} value={o.status} disabled={busy === o.id} onChange={(e) => change(o, e.target.value as OrderStatus)} className="min-w-44">
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ts(s)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
