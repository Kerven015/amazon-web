import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { ConfirmationView } from "@/components/checkout/confirmation-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { getOrderById } from "@/lib/api";
import { requireSignIn } from "@/lib/session";

/** Only the customer who placed the order can see it (anyone else: "Order not found"). */
export async function confirmationLoader({ params, request }: LoaderFunctionArgs) {
  await requireSignIn(request, params.locale ?? "en");
  const id = params.id ?? "";
  return { id, order: await getOrderById(id) };
}

/** /order/:id/confirmation */
export default function ConfirmationPage() {
  const t = useT();
  const { id, order } = useLoaderData<typeof confirmationLoader>();
  return (
    <Container className="py-8">
      <PageTitle title={t("checkout.confirmedPageTitle")} />
      <ConfirmationView id={id} order={order} />
    </Container>
  );
}
