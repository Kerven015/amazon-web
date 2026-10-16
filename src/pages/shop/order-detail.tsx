import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { OrderDetailView } from "@/components/account/order-detail-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { getOrderById } from "@/lib/api";

export async function orderDetailLoader({ params }: LoaderFunctionArgs) {
  const id = params.id ?? "";
  return { id, order: await getOrderById(id) };
}

/** /account/orders/:id */
export default function OrderDetailPage() {
  const t = useT();
  const { id, order } = useLoaderData<typeof orderDetailLoader>();
  return (
    <Container className="max-w-6xl py-6">
      <PageTitle title={t("orders.pageTitle", { id })} />
      <OrderDetailView id={id} fallback={order} />
    </Container>
  );
}
