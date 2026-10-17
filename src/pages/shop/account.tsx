import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { AccountView } from "@/components/account/account-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { getCurrentUser, getOrders, getProducts } from "@/lib/api";
import { requireSignIn } from "@/lib/session";

/** Signed out → /login?next=/account… */
export async function accountLoader({ request, params }: LoaderFunctionArgs) {
  await requireSignIn(request, params.locale ?? "en");
  const [user, orders, products] = await Promise.all([getCurrentUser(), getOrders(), getProducts()]);
  return { user, orders, products };
}

/** /account?tab=orders|wishlist|addresses|profile */
export default function AccountPage() {
  const t = useT();
  const { user, orders, products } = useLoaderData<typeof accountLoader>();
  return (
    <Container className="py-6">
      <PageTitle title={t("account.pageTitle")} />
      <AccountView user={user} orders={orders} products={products} />
    </Container>
  );
}
