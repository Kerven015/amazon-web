import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminTable, BarChart, EmptyState, StatTile, Th, pick } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { statusMeta } from "@/components/account/account-view";
import { formatDate, formatPrice, useLocale, useT } from "@/i18n";
import { adminApi, type Dashboard } from "@/lib/admin-api";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

export async function adminDashboardLoader() {
  return { dashboard: await adminApi.dashboard() };
}

const STATUSES: OrderStatus[] = ["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"];

/** /admin/dashboard — today, the last 30 days, what needs doing, and low stock. All from the database. */
export default function AdminDashboardPage() {
  const t = useT("admin.dashboard");
  const ts = useT("orders.status");
  const locale = useLocale();
  const [d, setD] = useState<Dashboard>(useLoaderData<typeof adminDashboardLoader>().dashboard);
  const [refreshing, setRefreshing] = useState(false);
  const price = (n: number) => formatPrice(n, locale);
  const day = (k: string) => formatDate(`${k}T12:00:00`, { day: "numeric", month: "short" }, locale);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setD(await adminApi.dashboard());
    } catch {
      toast.error(t("refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <AdminPageHeader title={t("title")} intro={t("intro", { tz: d.timeZone })}>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn(refreshing && "animate-spin")} aria-hidden="true" /> {t("refresh")}
        </Button>
      </AdminPageHeader>

      <section aria-labelledby="dash-today" className="mb-8">
        <h2 id="dash-today" className="mb-3 text-xl">{t("today")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("ordersToday")} value={d.today.orders} />
          <StatTile label={t("salesToday")} value={price(d.today.total)} sub={t("salesHint")} />
          <Link href="/admin/orders?status=placed" className="block">
            <StatTile label={t("toPack")} value={d.toPack} tone={d.toPack ? "warning" : undefined} sub={t("viewOrders")} />
          </Link>
          <Link href="/admin/orders?status=packed" className="block">
            <StatTile label={t("toShip")} value={d.toShip} tone={d.toShip ? "warning" : undefined} sub={t("viewOrders")} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="dash-30" className="mb-8">
        <h2 id="dash-30" className="mb-3 text-xl">{t("last30")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("sales")} value={price(d.last30Days.total)} sub={t("netSales", { value: price(d.last30Days.netSales) })} />
          <StatTile label={t("orders")} value={d.last30Days.orders} sub={t("units", { count: d.last30Days.units })} />
          <StatTile label={t("averageOrder")} value={price(d.last30Days.averageOrder)} />
          <StatTile label={t("customers")} value={d.customers.total} sub={t("newCustomers", { count: d.customers.newLast30Days })} />
        </div>
        <div className="mt-3">
          <BarChart label={t("dailySales")} data={d.daily.map((x) => ({ key: x.day, value: x.total }))} format={price} formatKey={day} />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="dash-status">
          <h2 id="dash-status" className="mb-3 text-xl">{t("byStatus")}</h2>
          <ul className="divide-y rounded-sm border bg-card text-sm">
            {STATUSES.map((s) => (
              <li key={s}>
                <Link href={`/admin/orders?status=${s}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50">
                  <Badge variant={statusMeta[s].variant}>{ts(s)}</Badge>
                  <span className="font-semibold">{d.ordersByStatus[s] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="dash-stock">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="dash-stock" className="text-xl">{t("stock")}</h2>
            <Link href="/admin/inventory" className="text-sm underline underline-offset-4">{t("openInventory")}</Link>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <StatTile label={t("outOfStock")} value={d.stock.out} tone={d.stock.out ? "danger" : undefined} />
            <StatTile label={t("lowStock")} value={d.stock.low} tone={d.stock.low ? "warning" : undefined} sub={t("threshold", { count: d.lowStockThreshold })} />
          </div>
          {d.stock.cells.length === 0 ? (
            <EmptyState>{t("stockFine")}</EmptyState>
          ) : (
            <ul className="divide-y rounded-sm border bg-card text-sm">
              {d.stock.cells.map((c) => (
                <li key={`${c.productId}|${c.size}|${c.colour}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    <Link href={`/admin/products/${c.productId}/edit`} className="font-medium hover:underline">{pick(c.title, locale)}</Link>
                    <span className="text-muted-foreground"> · {[c.size, c.colour === "default" ? "" : c.colour].filter(Boolean).join(", ")}</span>
                  </span>
                  <span className={cn("font-semibold", c.quantity <= 0 ? "text-danger" : "text-warning")}>{c.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-best">
          <h2 id="dash-best" className="mb-3 text-xl">{t("bestSellers")}</h2>
          {d.bestSellers.length === 0 ? (
            <EmptyState>{t("noSales")}</EmptyState>
          ) : (
            <AdminTable minWidth={360} head={<><Th>{t("product")}</Th><Th right>{t("unitsSold")}</Th><Th right>{t("itemSales")}</Th></>}>
              {d.bestSellers.map((b) => (
                <tr key={b.productId}>
                  <td className="px-4 py-2.5">{b.title}</td>
                  <td className="px-4 py-2.5 text-right">{b.units}</td>
                  <td className="price px-4 py-2.5 text-right">{price(b.sales)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>

        <section aria-labelledby="dash-recent">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="dash-recent" className="text-xl">{t("recentOrders")}</h2>
            <Link href="/admin/orders" className="text-sm underline underline-offset-4">{t("allOrders")}</Link>
          </div>
          {d.recentOrders.length === 0 ? (
            <EmptyState>{t("noOrders")}</EmptyState>
          ) : (
            <ul className="divide-y rounded-sm border bg-card text-sm">
              {d.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders?open=${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/50">
                    <span>
                      <span className="font-semibold">{o.id}</span> <span className="text-muted-foreground">· {o.customerName} · {formatDate(o.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, locale)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant={statusMeta[o.status].variant}>{ts(o.status)}</Badge>
                      <span className="price font-semibold">{price(o.total)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        {t("reviewsNote", { recent: d.reviews.last7Days, hidden: d.reviews.hidden })} <Link href="/admin/reviews" className="underline underline-offset-4">{t("openReviews")}</Link>
      </p>
    </Container>
  );
}
