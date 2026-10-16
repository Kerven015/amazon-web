import { useLoaderData } from "react-router";
import { CartView } from "@/components/cart/cart-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { getCompleteTheLook } from "@/lib/api";

export async function cartLoader() {
  return { suggestions: await getCompleteTheLook([], 10) };
}

/** /cart — full-page Shopping Bag */
export default function CartPage() {
  const t = useT();
  const { suggestions } = useLoaderData<typeof cartLoader>();
  return (
    <Container className="py-12">
      <PageTitle title={t("cart.pageTitle")} />
      <CartView suggestions={suggestions} />
    </Container>
  );
}
