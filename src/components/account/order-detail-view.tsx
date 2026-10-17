import { ArrowLeft, Printer, RotateCcw } from "lucide-react";
import { Link } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";
import { statusMeta } from "./account-view";
import { OrderItemsList, OrderTotals } from "./order-details";
import { OrderTimeline } from "./order-timeline";
import { useT } from "@/i18n";
import { addressLine, countryName, deliveryLabel, paymentLabel, statusLabel } from "@/lib/order-format";
import { deliveryOption, deliveryWindow } from "@/lib/delivery";

/** One of the customer's orders, from the account (someone else's → "not found"). */
export function OrderDetailView({ order }: { order: Order | null }) {
  const t = useT("orders");
  const delivered = order?.status === "delivered";
  const option = order ? deliveryOption(order.deliveryOption) : undefined;

  if (!order) {
    return (
      <div className="rounded-sm border bg-card p-8 text-center">
        <h1 className="text-3xl">{t("notFound")}</h1>
        <Button asChild className="mt-4">
          <Link href="/account?tab=orders">{t("backToOrders")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/account?tab=orders" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-navy hover:underline print:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" /> {t("yourOrders")}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl text-balance [overflow-wrap:anywhere]">{t("pageTitle", { id: order.id })}</h1>
          <p className="text-sm text-muted-foreground">{t("placedOn", { date: formatDate(order.createdAt) })}</p>
        </div>
        <div className="print:hidden">
          <div className="flex flex-wrap gap-2">
            {/* The order page is the invoice: print it (or save as PDF from the print dialog). */}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" /> {t("printInvoice")}
            </Button>
            {delivered ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/help/returns">
                  <RotateCcw aria-hidden="true" /> {t("returnItems")}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled aria-describedby="returns-note">
                <RotateCcw aria-hidden="true" /> {t("returnItems")}
              </Button>
            )}
          </div>
          {!delivered && (
            <p id="returns-note" className="mt-1.5 text-xs text-muted-foreground sm:text-right">
              {t("returnsOpen")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="track-h" className="rounded-sm border bg-card p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 id="track-h" className="text-2xl">{t("trackingTitle")}</h2>
            <Badge variant={statusMeta[order.status].variant}>{statusLabel(order.status)}</Badge>
            <span className="text-sm text-muted-foreground">
              {delivered
                ? t("deliveredOn", { date: formatDate(order.estimatedDelivery, { weekday: "short", year: undefined }) })
                : t("arriving", { date: option ? deliveryWindow(option.id, new Date(order.createdAt)) : formatDate(order.estimatedDelivery, { weekday: "short", year: undefined }) })}
            </span>
          </div>
          <OrderTimeline events={order.tracking} />
          <h2 className="mb-1 mt-8 text-2xl">{t("items")}</h2>
          <OrderItemsList order={order} />
        </section>

        <aside className="space-y-4">
          <section className="rounded-sm border bg-card p-4 text-sm">
            <h2 className="mb-1 text-sm font-medium">{t("shippingAddress")}</h2>
            <p>{order.address.fullName}</p>
            <p className="text-muted-foreground">{addressLine(order.address)}</p>
            <p className="text-muted-foreground">{countryName(order.address.country)}</p>
            <h2 className="mb-1 mt-4 text-sm font-medium">{t("delivery")}</h2>
            <p className="text-muted-foreground">{deliveryLabel(order.deliveryOption)}</p>
            <h2 className="mb-1 mt-4 text-sm font-medium">{t("payment")}</h2>
            <p className="text-muted-foreground">{paymentLabel(order.paymentMethod)}</p>
          </section>
          <section className="rounded-sm border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">{t("summary")}</h2>
            <OrderTotals order={order} />
          </section>
        </aside>
      </div>
    </div>
  );
}
