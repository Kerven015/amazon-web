import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { CollectionView } from "@/components/collection/collection-view";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { getCollection } from "@/lib/api";
import { notFound } from "@/lib/router";

export async function collectionLoader({ params }: LoaderFunctionArgs) {
  const slug = params.slug ?? "";
  const collection = await getCollection(slug);
  if (!collection) notFound();
  return { slug, collection };
}

/** /:locale/collections/:slug — towel collections linked from the main navigation (lib/navigation.ts). */
export default function TowelCollectionPage() {
  const { slug, collection } = useLoaderData<typeof collectionLoader>();
  const t = useT();
  // Title and intro per language: messages → collections.{slug}
  const title = t.has(`collections.${slug}.title`) ? t(`collections.${slug}.title`) : collection.title;
  const intro = t.has(`collections.${slug}.intro`) ? t(`collections.${slug}.intro`) : collection.intro;
  return (
    <Container>
      <PageTitle title={title} description={intro} />
      <CollectionView
        key={slug}
        products={collection.products}
        title={title}
        intro={intro}
        crumbs={[
          { label: t("common.home"), href: "/" },
          ...(slug === "all-towels" ? [] : [{ label: t("collections.all-towels.title"), href: "/collections/all-towels" }]),
          { label: title },
        ]}
      />
    </Container>
  );
}
