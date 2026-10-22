import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { type LoaderFunctionArgs, useLoaderData, useNavigation, useRevalidator, useSearchParams } from "react-router";
import { AdminPageHeader, AdminTable, ClearHistoryButton, EmptyState, FilterChips, Th } from "@/components/admin/admin-ui";
import { OrderTotals } from "@/components/account/order-details";
import { OrderTimeline } from "@/components/account/order-timeline";
import { statusMeta } from "@/components/account/account-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { formatDate, formatPrice, useLocale, useT } from "@/i18n";
import { type AdminOrder, type AuditEntry, adminApi, ApiError } from "@/lib/admin-api";
import { addressLine, countryName, deliveryLabel, paymentLabel } from "@/lib/order-format";
import { nextStatuses } from "@/lib/order-tracking";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

type StatusFilter = "all" | "open" | OrderStatus;
const STATUS_FILTERS: StatusFilter[] = ["all", "open", "placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"];
const SORTS = ["newest", "oldest", "total_desc", "total_asc"] as const;
type Sort = (typeof SORTS)[number];

/** Local midnight of a YYYY-MM-DD day, as an ISO instant (to = the day after, exclusive). */
const dayStart = (day: string, plus = 0) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + plus);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Filters live in the URL (?status=&q=&from=&to=&sort=&open=), so links from the dashboard work. */
function filterFrom(params: URLSearchParams) {
  const status = params.get("status") as StatusFilter | null;
  const sort = params.get("sort") as Sort | null;
  return {
    status: status && STATUS_FILTERS.includes(status) ? status : "all",
    q: params.get("q") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
  };
}

export async function adminOrdersLoader({ request }: LoaderFunctionArgs) {
  const f = filterFrom(new URL(request.url).searchParams);
  const orders = await adminApi.orders({
    q: f.q || undefined,
    status: f.status === "all" ? undefined : f.status,
    from: f.from ? dayStart(f.from) : undefined,
    to: f.to ? dayStart(f.to, 1) : undefined,
    sort: f.sort,
  });
  return { orders };
}

/** /admin/orders — search, filter and sort orders; open one for its details, shipment and history. */
export default function AdminOrdersPage() {
  const t = useT("admin.orders");
  const ts = useT("orders.status");
  const locale = useLocale();
  const loaded = useLoaderData<typeof adminOrdersLoader>().orders;
  const [orders, setOrders] = useState<AdminOrder[]>(loaded);
  useEffect(() => setOrders(loaded), [loaded]);
  const [params, setParams] = useSearchParams();
  const f = filterFrom(params);
  const [query, setQuery] = useState(f.q);
  const [busy, setBusy] = useState<string | null>(null);
  const loading = useNavigation().state === "loading";
  const revalidator = useRevalidator();
  const openId = params.get("open");

  const update = (next: Partial<Record<"status" | "q" | "from" | "to" | "sort" | "open", string>>) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        for (const [k, v] of Object.entries(next)) v && v !== "all" && !(k === "sort" && v === "newest") ? out.set(k, v) : out.delete(k);
        return out;
      },
      { replace: true, preventScrollReset: true },
    );

  // Search as you type (after a short pause)
  useEffect(() => {
    if (query === f.q) return;
    const id = setTimeout(() => update({ q: query.trim() }), 350);
    return () => clearTimeout(id);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const replace = (updated: AdminOrder) => setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)));

  const change = async (order: AdminOrder, status: OrderStatus) => {
    if (status === order.status) return;
    if (status === "cancelled" && !window.confirm(t("confirmCancel", { id: order.id }))) return;
    setBusy(order.id);
    try {
      replace(await adminApi.setOrderStatus(order.id, status));
      toast.success(t("updated", { id: order.id, status: ts(status) }));
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 409 ? t("notAllowed") : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const filtered = f.status !== "all" || f.q || f.from || f.to;

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <AdminPageHeader title={t("title")} intro={t("intro")}>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? <LoaderCircle className="inline size-4 animate-spin" aria-label={t("loading")} /> : t("count", { count: orders.length })}
        </p>
        <ClearHistoryButton what="orders" onCleared={() => revalidator.revalidate()} />
      </AdminPageHeader>

      <div className="mb-4 space-y-3">
        <FilterChips label={t("filterLabel")} value={f.status} onChange={(status) => update({ status })} options={STATUS_FILTERS.map((s) => ({ value: s, label: s === "all" ? t("all") : s === "open" ? t("open") : ts(s) }))} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
          </div>
          <div>
            <Label htmlFor="orders-from" className="mb-1 block text-xs">{t("from")}</Label>
            <Input id="orders-from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => update({ from: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="orders-to" className="mb-1 block text-xs">{t("to")}</Label>
            <Input id="orders-to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="orders-sort" className="mb-1 block text-xs">{t("sort")}</Label>
            <Select id="orders-sort" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s} value={s}>{t(`sorts.${s}`)}</option>
              ))}
            </Select>
          </div>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => (setQuery(""), setParams(new URLSearchParams(), { replace: true }))}>
              {t("clear")}
            </Button>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState>{filtered ? t("noMatch") : t("empty")}</EmptyState>
      ) : (
        <AdminTable
          minWidth={860}
          head={
            <>
              <Th>{t("order")}</Th>
              <Th>{t("placed")}</Th>
              <Th>{t("customer")}</Th>
              <Th>{t("items")}</Th>
              <Th right>{t("total")}</Th>
              <Th>{t("status")}</Th>
              <Th><span className="sr-only">{t("details")}</span></Th>
            </>
          }
        >
          {orders.map((o) => {
            const options = nextStatuses(o.status);
            return (
              <tr key={o.id} className={cn("align-top", loading && "opacity-60")}>
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
                  {options.length === 0 ? (
                    <Badge variant={statusMeta[o.status].variant}>{ts(o.status)}</Badge>
                  ) : (
                    <Select aria-label={t("statusFor", { id: o.id })} value={o.status} disabled={busy === o.id} onChange={(e) => change(o, e.target.value as OrderStatus)} className="min-w-44">
                      {[o.status, ...options].map((s) => (
                        <option key={s} value={s}>{ts(s)}</option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => update({ open: o.id })} aria-label={t("detailsFor", { id: o.id })}>
                    {t("details")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}

      <OrderSheet id={openId} onClose={() => update({ open: "" })} onChange={replace} onStatus={change} />
    </Container>
  );
}

/** Side panel: everything about one order, shipment details, status and its activity. */
function OrderSheet({ id, onClose, onChange, onStatus }: { id: string | null; onClose: () => void; onChange: (o: AdminOrder) => void; onStatus: (o: AdminOrder, s: OrderStatus) => Promise<void> }) {
  const t = useT("admin.orders");
  const ts = useT("orders.status");
  const ta = useT("admin.activity.actions");
  const locale = useLocale();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [error, setError] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (orderId: string) => {
    setError(false);
    try {
      const [o, h] = await Promise.all([adminApi.order(orderId), adminApi.activity({ entityType: "order", entityId: orderId })]);
      setOrder(o);
      setHistory(h);
      setCarrier(o.carrier ?? "");
      setTracking(o.trackingNumber ?? "");
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    setOrder(null);
    if (id) void load(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSaving(true);
    try {
      const o = await adminApi.setShipment(order.id, carrier, tracking);
      setOrder(o);
      onChange(o);
      setHistory(await adminApi.activity({ entityType: "order", entityId: order.id }));
      toast.success(t("shipmentSaved"));
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 422 ? t("trackingInvalid") : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (s: OrderStatus) => {
    if (!order) return;
    await onStatus(order, s);
    await load(order.id);
  };

  const o = order;
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" title={o ? t("orderTitle", { id: o.id }) : t("order")} bodyClassName="px-5 py-5 sm:px-6">
        {error ? (
          <p role="alert" className="text-sm text-danger">{t("loadFailed")}</p>
        ) : !o ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {t("loading")}
          </p>
        ) : (
          <div className="space-y-6 text-sm">
            <section className="flex flex-wrap items-center gap-2">
              <Badge variant={statusMeta[o.status].variant}>{ts(o.status)}</Badge>
              <span className="text-muted-foreground">{formatDate(o.createdAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }, locale)}</span>
            </section>

            {nextStatuses(o.status).length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold">{t("moveTo")}</h3>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses(o.status).map((s) => (
                    <Button key={s} size="sm" variant={s === "cancelled" ? "destructive" : "outline"} onClick={() => setStatus(s)}>
                      {ts(s)}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("statusRule")}</p>
              </section>
            )}

            <section>
              <h3 className="mb-2 font-semibold">{t("customer")}</h3>
              <p className="font-medium">{o.customerName}</p>
              <p className="break-all text-muted-foreground">{o.email}</p>
              <p className="mt-2">{o.address.fullName}</p>
              <p className="text-muted-foreground">{addressLine(o.address)}, {countryName(o.address.country)}</p>
              <p className="text-muted-foreground">{o.address.phone}</p>
            </section>

            <section>
              <h3 className="mb-2 font-semibold">{t("items")}</h3>
              <ul className="divide-y rounded-sm border">
                {o.items.map((i) => (
                  <li key={`${i.productId}|${i.variant?.size ?? ""}|${i.variant?.color ?? ""}`} className="flex justify-between gap-3 px-3 py-2">
                    <span>
                      <span className="block font-medium">{i.quantity} × {i.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[i.variant?.size, i.variant?.color, i.sku ? `${t("sku")} ${i.sku}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="price whitespace-nowrap">{formatPrice(i.price * i.quantity, locale)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3"><OrderTotals order={o} /></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <dt>{t("delivery")}</dt>
                <dd>{deliveryLabel(o.deliveryOption)}</dd>
                <dt>{t("payment")}</dt>
                <dd>{paymentLabel(o.paymentMethod)} <span className="text-xs">({t("demoPayment")})</span></dd>
                {o.discountCode && (
                  <>
                    <dt>{t("discountCode")}</dt>
                    <dd>{o.discountCode}</dd>
                  </>
                )}
              </dl>
            </section>

            <form onSubmit={saveShipment} className="space-y-3">
              <h3 className="font-semibold">{t("shipment")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ship-carrier" className="mb-1 block text-xs">{t("carrier")}</Label>
                  <Input id="ship-carrier" value={carrier} maxLength={60} onChange={(e) => setCarrier(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ship-tracking" className="mb-1 block text-xs">{t("trackingNumber")}</Label>
                  <Input id="ship-tracking" value={tracking} maxLength={100} onChange={(e) => setTracking(e.target.value)} />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />} {t("saveShipment")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("shipmentNote")}</p>
            </form>

            <section>
              <h3 className="mb-2 font-semibold">{t("tracking")}</h3>
              <OrderTimeline events={o.tracking} />
            </section>

            <section>
              <h3 className="mb-2 font-semibold">{t("history")}</h3>
              {history.length === 0 ? (
                <p className="text-muted-foreground">{t("noHistory")}</p>
              ) : (
                <ul className="space-y-1">
                  {history.map((h) => (
                    <li key={h.id} className="text-muted-foreground">
                      <span className="text-foreground">{ta.has(h.action) ? ta(h.action) : h.action}</span>
                      {h.action === "order.status" && ` · ${ts(String(h.details.from))} → ${ts(String(h.details.to))}`} · {h.actor} · {formatDate(h.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, locale)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
