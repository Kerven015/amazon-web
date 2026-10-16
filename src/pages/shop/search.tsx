import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { CollectionView } from "@/components/collection/collection-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { searchProducts } from "@/lib/api";

export async function searchLoader({ request }: LoaderFunctionArgs) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q") ?? "";
  const deals = sp.get("deals") === "1";
  return { q, deals, products: await searchProducts({ q, deals }) };
}

/** /:locale/search?q=… · ?deals=1 · (shop all). Search ignores accents and works in every language. */
export default function SearchPage() {
  const { q, deals, products } = useLoaderData<typeof searchLoader>();
  const t = useT("searchPage");

  const title = deals ? t("saleTitle") : q ? t("resultsTitle", { query: q }) : t("allTitle");
  const intro = deals ? t("saleIntro") : q ? t("resultsIntro", { query: q }) : t("allIntro");

  return (
    <Container>
      <PageTitle title={deals ? t("saleTitle") : q ? t("resultsPageTitle", { query: q }) : t("allTitle")} description={intro} />
      <CollectionView
        key={`${q}-${deals}`}
        products={products}
        title={title}
        intro={intro}
        crumbs={[{ label: t("home"), href: "/" }, { label: deals ? t("saleCrumb") : q ? t("searchCrumb") : t("allTitle") }]}
      />
    </Container>
  );
}
