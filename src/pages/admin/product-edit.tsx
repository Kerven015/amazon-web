import { ArrowLeft } from "lucide-react";
import { type LoaderFunctionArgs, useLoaderData, useLocation } from "react-router";
import { AdminProductForm } from "@/components/admin/product-form";
import { Container } from "@/components/layout/container";
import { ensureCatalog, getRecordById } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import { productHref } from "@/lib/product-utils";
import { Link, notFound } from "@/lib/router";
import { LAST_CATALOG_KEY } from "./catalog";
import { useLocale, useT } from "@/i18n";
import { ADMIN_BASE } from "@/lib/admin-path";

function lastCatalog() {
  try {
    return sessionStorage.getItem(LAST_CATALOG_KEY) || ADMIN_BASE;
  } catch {
    return ADMIN_BASE;
  }
}

export async function adminEditLoader({ params }: LoaderFunctionArgs) {
  await ensureCatalog("admin");
  const product = getRecordById(params.id ?? "");
  if (!product) notFound();
  return { product, returnTo: lastCatalog() };
}

export async function adminNewLoader({ request }: LoaderFunctionArgs) {
  await ensureCatalog("admin");
  return { collection: new URL(request.url).searchParams.get("collection"), returnTo: lastCatalog() };
}

function Header({ title, returnTo, children }: { title: string; returnTo: string; children?: React.ReactNode }) {
  const t = useT("admin.edit");
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 py-6">
      <div>
        <Link href={returnTo} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" /> {t("backToCatalog")}
        </Link>
        <h1 className="mt-2 text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** /admin/products/:id/edit */
export function AdminEditProductPage() {
  const { product, returnTo } = useLoaderData<typeof adminEditLoader>();
  const t = useT("admin.edit");
  const locale = useLocale();
  const name = (locale !== "en" && product.title[locale]) || product.title.en;
  return (
    <Container>
      <title>{t("pageEdit", { name, store: siteConfig.name })}</title>
      <Header title={t("editTitle")} returnTo={returnTo}>
        {!product.hidden && (
          // Opens the store in the same language as the admin
          <a href={`/${locale}${productHref({ slug: product.slug })}`} target="_blank" rel="noopener" className="text-sm underline underline-offset-4">
            {t("viewOnStore")} ↗
          </a>
        )}
      </Header>
      <AdminProductForm key={product.id} product={product} returnTo={returnTo} />
    </Container>
  );
}

/** /admin/products/new (?collection=bath-towels preselects the category) */
export function AdminNewProductPage() {
  const { collection, returnTo } = useLoaderData<typeof adminNewLoader>();
  // New key after "Save and add another" so the form starts empty
  const location = useLocation();
  const t = useT("admin.edit");
  return (
    <Container>
      <title>{t("pageAdd", { store: siteConfig.name })}</title>
      <Header title={t("addTitle")} returnTo={returnTo} />
      <AdminProductForm key={location.key} collection={collection} returnTo={returnTo} />
    </Container>
  );
}
