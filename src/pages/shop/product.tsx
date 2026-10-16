import { type LoaderFunctionArgs, redirect, useLoaderData } from "react-router";
import { Container } from "@/components/layout/container";
import { ScrollProgress } from "@/components/motion-ui/scroll-progress";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductReviews } from "@/components/product/product-reviews";
import { ProductRow } from "@/components/product/product-row";
import { ProductSeo } from "@/components/product/product-seo";
import { RecentlyViewedRow, TrackProductView } from "@/components/product/recently-viewed";
import { getProductById } from "@/lib/api";
import { loadProductPage } from "@/lib/product-page-data";
import { productHref } from "@/lib/product-utils";
import { Link, notFound } from "@/lib/router";
import { useT } from "@/i18n";

export async function productLoader({ params, request }: LoaderFunctionArgs) {
  const data = await loadProductPage(params.slug ?? "");
  // Unknown, hidden or deleted → the site's 404 page
  if (!data) notFound();
  const colourParam = new URL(request.url).searchParams.get("colour")?.toLowerCase();
  const colour = data.product.variants.colors?.find((c) => c.name.toLowerCase() === colourParam)?.name;
  return { ...data, colour };
}

/** Old /product/:id links (cart, orders, bookmarks) → /products/:slug */
export async function legacyProductLoader({ params, request }: LoaderFunctionArgs) {
  const product = await getProductById(params.id ?? "");
  if (!product) notFound();
  const colour = new URL(request.url).searchParams.get("colour") ?? undefined;
  return redirect(productHref(product, colour));
}

/** /products/:slug (optional ?colour=sand preselects a colour) */
export default function ProductPage() {
  const { product, look, related, crumb, colour } = useLoaderData<typeof productLoader>();
  const t = useT("productPage");
  const tc = useT("common");

  return (
    <>
      <ProductSeo product={product} />
      <ScrollProgress />
      <TrackProductView productId={product.id} />
      <div className="theme-cream">
        <Container className="space-y-20 pb-16 sm:space-y-24">
          <div>
            <nav aria-label={t("breadcrumb")} className="py-5 text-xs text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="hover:text-foreground hover:underline">{tc("home")}</Link>
                </li>
                {crumb && (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <Link href={crumb.href} className="hover:text-foreground hover:underline">{crumb.label}</Link>
                    </li>
                  </>
                )}
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="line-clamp-1 text-foreground">{product.title}</li>
              </ol>
            </nav>
            <ProductDetail key={`${product.id}-${colour ?? ""}`} product={product} initialColor={colour} />
          </div>

          {look.length > 0 && <ProductRow eyebrow={t("pairsWellWith")} title={t("completeTheLook")} products={look} />}
          <ProductReviews product={product} />
          {related.length > 0 && (
            <ProductRow eyebrow={t("moreLikeThis")} title={t("youMayAlsoLike")} products={related} href={crumb?.href} />
          )}
          <RecentlyViewedRow excludeId={product.id} max={8} />
        </Container>
      </div>
    </>
  );
}
