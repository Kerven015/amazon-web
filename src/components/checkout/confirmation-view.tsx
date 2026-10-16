import { motion } from "motion/react";
import { CircleCheck, Package } from "lucide-react";
import { Link } from "@/lib/router";
import { OrderItemsList, OrderTotals } from "@/components/account/order-details";
import { OrderTimeline } from "@/components/account/order-timeline";
import { TextShimmer } from "@/components/motion-ui/text-shimmer";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useStoreHydrated } from "@/lib/hooks/use-store-hydrated";
import { usePlacedOrders } from "@/lib/store/orders";
import type { Order } from "@/types";
import { formatDate, useT } from "@/i18n";
import { addressLine, countryName, deliveryLabel, paymentLabel } from "@/lib/order-format";
import { deliveryOption, deliveryWindow } from "@/lib/delivery";

export function ConfirmationView({ id, fallback }: { id: string; fallback: Order | null }) {
  const hydrated = useStoreHydrated(usePlacedOrders);
  const mounted = useMounted();
  const placed = usePlacedOrders((s) => s.orders.find((o) => o.id === id));
  const order = placed ?? fallback;
  const t = useT("confirmation");

  if (!hydrated && !fallback) {
    return (
      <p role="status" className="py-20 text-center text-lg">
        <TextShimmer>{t("loading")}</TextShimmer>
      </p>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md rounded-sm border bg-card p-8 text-center">
        <h1 className="text-3xl">{t("notFoundTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("notFoundBody", { id })}</p>
        <Button asChild className="mt-4">
          <Link href="/account?tab=orders">{t("viewOrders")}</Link>
        </Button>
      </div>
    );
  }

  // Same business-day rules as the product page and checkout (lib/delivery.ts)
  const option = deliveryOption(order.deliveryOption);
  const eta = !mounted
    ? ""
    : option
      ? deliveryWindow(option.id, new Date(order.createdAt))
      : formatDate(new Date(order.estimatedDelivery), { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-sm border bg-card p-6 text-center sm:p-10"
      >
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success"
        >
          <CircleCheck className="size-9" aria-hidden="true" />
        </motion.span>
        <h1 className="mt-4 text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto sm:text-5xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.rich("orderSent", { id: <span className="font-semibold text-foreground">{order.id}</span> })}
        </p>
        {eta && (
          <p className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-sm border border-navy/15 bg-cream px-4 py-2 text-sm font-medium text-navy">
            <Package className="size-4 shrink-0" aria-hidden="true" /> {t("eta", { date: eta })}
            {option && <span className="font-normal opacity-80">· {deliveryLabel(option.id)}</span>}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/">{t("continueShopping")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/account?tab=orders">{t("viewOrders")}</Link>
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="items-heading" className="rounded-sm border bg-card p-4 sm:p-6">
          <h2 id="items-heading" className="mb-2 text-2xl">{t("items")}</h2>
          <OrderItemsList order={order} />
          <div className="mt-4 border-t pt-4">
            <OrderTotals order={order} />
          </div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-sm border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">{t("tracking")}</h2>
            <OrderTimeline events={order.tracking} />
          </section>
          <section className="rounded-sm border bg-card p-4 text-sm">
            <h2 className="mb-1 text-sm font-medium">{t("shippingTo")}</h2>
            <p>{order.address.fullName}</p>
            <p className="text-muted-foreground">{addressLine(order.address)}</p>
            <p className="text-muted-foreground">{countryName(order.address.country)}</p>
            {order.address.phone && <p className="text-muted-foreground">{order.address.phone}</p>}
            <h2 className="mb-1 mt-3 text-sm font-medium">{t("payment")}</h2>
            <p className="text-muted-foreground">{paymentLabel(order.paymentMethod)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
