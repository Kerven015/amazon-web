import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  ScrollRestoration,
  useLocation,
  useNavigation,
  useParams,
  useRevalidator,
  useRouteError,
} from "react-router";
import { I18nProvider, isLocale, type Locale, locales, localizePath, negotiateLocale, setActiveLocale, splitLocale, useT, translate, LOCALE_COOKIE } from "@/i18n";
import { onCatalogChange } from "@/lib/catalog";
import { ProductSkeleton } from "@/components/product/product-skeleton";
import { DrawerHost } from "@/components/layout/drawer-host";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Logo } from "@/components/layout/logo";
import { PageTitle } from "@/components/layout/page-title";
import { Providers } from "@/components/layout/providers";
import { StatusPage } from "@/components/layout/status-page";
import { TextShimmer } from "@/components/motion-ui/text-shimmer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { siteConfig } from "@/lib/config";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

/** App root: theme, motion settings, store hydration, toasts, scroll restoration. */
export function RootLayout() {
  // When the catalogue reloads (admin save, shopper returns to the tab), re-run the
  // current page's loader so what's on screen matches the live data.
  const revalidator = useRevalidator();
  useEffect(() => onCatalogChange(() => void revalidator.revalidate()), [revalidator]);
  return (
    <Providers>
      <Outlet />
      <ScrollRestoration />
    </Providers>
  );
}

/* ------------------------------ language ------------------------------ */

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Saved choice (cookie) → browser languages → English. */
export function preferredLocale(): Locale {
  const saved = typeof document !== "undefined" ? readCookie(LOCALE_COOKIE) : null;
  if (isLocale(saved)) return saved;
  return negotiateLocale(typeof navigator !== "undefined" ? navigator.languages : []);
}

/** "/" → "/en" (or the saved / browser language). The server does the same for the first request. */
export function rootRedirectLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  throw redirect(`/${preferredLocale()}${url.search}`);
}

/** /:locale/* — validates the language; "/collections/x" (no prefix) → "/en/collections/x". */
export function localeLoader({ params, request }: LoaderFunctionArgs) {
  if (!isLocale(params.locale)) {
    const url = new URL(request.url);
    throw redirect(`${localizePath(url.pathname, preferredLocale())}${url.search}${url.hash}`);
  }
  setActiveLocale(params.locale);
  return null;
}

/**
 * Wraps a page loader so non-React helpers (catalogue, prices, dates) use the
 * page's language. All loaders of one navigation share the same params.locale.
 */
export function withLocale<A extends LoaderFunctionArgs, R>(loader: (args: A) => R) {
  return (args: A) => {
    if (isLocale(args.params.locale)) setActiveLocale(args.params.locale);
    return loader(args);
  };
}

/** hreflang alternates for the current page (en, tr, tk, x-default → en). */
function AlternateLinks({ locale }: { locale: Locale }) {
  const location = useLocation();
  const { rest } = splitLocale(location.pathname);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = (l: Locale) => `${origin}${localizePath(rest, l)}${location.search}`;
  return (
    <>
      {locales.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={url(l)} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={url("en")} />
      <link rel="canonical" href={url(locale)} />
    </>
  );
}

/** Everything under /:locale: translations, <html lang>, hreflang. */
export function LocaleLayout() {
  const params = useParams();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nProvider locale={locale}>
      <AlternateLinks locale={locale} />
      <Outlet />
    </I18nProvider>
  );
}

/** Thin bar at the very top while a route's data is loading. */
function NavigationProgress() {
  const loading = useNavigation().state === "loading";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-x-0 top-0 z-[80] h-0.5 origin-left bg-navy transition-[transform,opacity] duration-500 ease-calm",
        loading ? "scale-x-75 opacity-100" : "scale-x-100 opacity-0",
      )}
    />
  );
}

/** True once `flag` has stayed true for `ms` (avoids skeleton flashes on fast loads). */
function useDelayed(flag: boolean, ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!flag) return setOn(false);
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [flag, ms]);
  return on;
}

/** Store pages: announcement bar, header with mega menu, footer and global drawers. */
export function ShopLayout() {
  const navigation = useNavigation();
  const location = useLocation();
  // Product pages show a skeleton with the page's layout while their data loads
  const nextPath = navigation.location ? splitLocale(navigation.location.pathname).rest : "";
  const loadingProduct =
    navigation.state === "loading" &&
    nextPath.startsWith("/products/") &&
    nextPath !== splitLocale(location.pathname).rest;
  const showSkeleton = useDelayed(loadingProduct, 150);

  return (
    <div className="theme-cream flex min-h-dvh flex-col">
      <NavigationProgress />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {showSkeleton ? <ProductSkeleton /> : <Outlet />}
      </main>
      <Footer />
      <DrawerHost />
    </div>
  );
}

/** Sign-in / register. */
export function AuthLayout() {
  const t = useT("footer");
  return (
    <div className="theme-cream flex min-h-dvh flex-col">
      <header className="border-b py-5">
        <div className="mx-auto flex max-w-md items-center justify-center px-4">
          <Logo />
        </div>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-14">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <nav aria-label={translate("footer.legal")} className="mb-2 flex justify-center gap-4">
          <Link href="/help/terms" className="hover:underline">{t("terms")}</Link>
          <Link href="/help/privacy" className="hover:underline">{t("privacy")}</Link>
          <Link href="/help/contact" className="hover:underline">{t("help")}</Link>
        </nav>
        {t("copyright", { year: String(new Date().getFullYear()), store: siteConfig.name })}
      </footer>
    </div>
  );
}

/** Shown while the first page's data loads. */
export function LoadingScreen() {
  const t = useT("common");
  if (typeof window !== "undefined" && splitLocale(window.location.pathname).rest.startsWith("/products/")) return <ProductSkeleton title={t("loadingProduct")} />;
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-10 lg:px-8" aria-busy="true">
      <p role="status" className="mb-6 text-lg font-semibold">
        <TextShimmer>{t("loading")}</TextShimmer>
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/5] w-full bg-cream" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  const t = useT("errors");
  return (
    <StatusPage code="404" title={t("notFoundTitle")} body={t("notFoundBody")}>
      <PageTitle title={t("notFoundPageTitle")} />
      <Button asChild size="lg">
        <Link href="/">{t("backHome")}</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/collections/towel-offers">{t("seeOffers")}</Link>
      </Button>
    </StatusPage>
  );
}

/** Route error boundary: 404s (thrown by loaders via notFound()) and unexpected errors. */
export function RouteError() {
  const error = useRouteError();
  const t = useT("errors");

  useEffect(() => {
    // TODO(backend): report to error monitoring (Sentry, etc.)
    if (!(isRouteErrorResponse(error) && error.status === 404)) console.error(error);
  }, [error]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <StatusPage code={t("oops")} title={t("genericTitle")} body={t("genericBody")}>
      <PageTitle title={t("genericTitle")} />
      <Button size="lg" onClick={() => window.location.reload()}>
        {t("tryAgain")}
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </StatusPage>
  );
}
