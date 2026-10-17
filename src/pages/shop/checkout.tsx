import type { LoaderFunctionArgs } from "react-router";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { requireSignIn } from "@/lib/session";

/** Buying needs an account: signed out → /login?next=/checkout, then back here with the same bag. */
export async function checkoutLoader({ request, params }: LoaderFunctionArgs) {
  await requireSignIn(request, params.locale ?? "en");
  return null;
}

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
