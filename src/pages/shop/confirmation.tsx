import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { ConfirmationView } from "@/components/checkout/confirmation-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { getOrderById } from "@/lib/api";

export async function confirmationLoader({ params }: LoaderFunctionArgs) {
  const id = params.id ?? "";
  // Mock orders resolve here; orders placed in this browser resolve from the local store.
  return { id, fallback: await getOrderById(id) };
}

/** /order/:id/confirmation */
export default function ConfirmationPage() {
  const t = useT();
  const { id, fallback } = useLoaderData<typeof confirmationLoader>();
  return (
    <Container className="py-8">
      <PageTitle title={t("checkout.confirmedPageTitle")} />
      <ConfirmationView id={id} fallback={fallback} />
    </Container>
  );
}
