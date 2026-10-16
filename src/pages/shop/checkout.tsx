import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";

/** /checkout */
export default function CheckoutPage() {
  const t = useT();
  return (
    <Container className="max-w-6xl py-6">
      <PageTitle title={t("checkout.pageTitle")} />
      <CheckoutFlow />
    </Container>
  );
}
