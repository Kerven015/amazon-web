import { ArrowUpRight, LoaderCircle, LogOut, Package } from "lucide-react";
import { useState } from "react";
import { Outlet, redirect, type LoaderFunctionArgs } from "react-router";
import { Logo } from "@/components/layout/logo";
import { MegaMenu, NavHrefProvider, useNavText } from "@/components/layout/mega-menu";
import { AdminLanguageSwitcher } from "@/components/admin/admin-i18n";
import { useT } from "@/i18n";
import { adminApi } from "@/lib/admin-api";
import { ensureCatalog } from "@/lib/catalog";
import { mainNav } from "@/lib/navigation";
import { Link, usePathname } from "@/lib/router";
import { cn } from "@/lib/utils";
import { NavIcon, type NavIconName } from "@/components/ui/nav-icon";

/** Every /admin page: needs a valid session (the server checks the cookie). */
export async function adminLayoutLoader({ request }: LoaderFunctionArgs) {
  const session = await adminApi.session();
  if (!session) {
    const url = new URL(request.url);
    throw redirect(`/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  await ensureCatalog("admin");
  return { username: session.username };
}

/** Public category links → the same category inside the admin. Non-catalog links are hidden. */
export const adminHref = (href: string) => (href.startsWith("/collections/") ? `/admin${href}` : null);

/** "Home" in the admin top bar → the catalog (/admin). Already there: scroll to the top. */
function AdminHomeLink() {
  const t = useT("admin.topbar");
  const pathname = usePathname();
  const here = pathname === "/admin";
  return (
    <Link
      href="/admin"
      aria-current={here ? "page" : undefined}
      onClick={(e) => {
        if (here && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }
      }}
      // Phones: hidden — the logo already goes to the catalog, and the switcher needs the room
      className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-sm hover:underline hover:underline-offset-4 aria-[current=page]:underline aria-[current=page]:underline-offset-4 max-sm:hidden"
    >
      <NavIcon name="home" size={16} />
      <span className="max-sm:sr-only">{t("home")}</span>
    </Link>
  );
}

/** Mobile: the same categories as a scrollable chip row (the mega menu is desktop-only). */
function MobileCategoryNav() {
  const t = useT("admin.topbar");
  const text = useNavText();
  const pathname = usePathname();
  const links = [
    { label: t("allProducts"), href: "/admin", icon: "allProducts" as NavIconName },
    ...mainNav.flatMap((item) => (item.groups ? item.groups.flatMap((g) => g.links.map((l) => ({ ...l, label: text.link(l) }))) : [{ label: text.item(item), href: item.href }])),
  ]
    .map((l) => ({ ...l, href: l.href === "/admin" ? l.href : adminHref(l.href) }))
    .filter((l, i, all): l is typeof l & { href: string } => !!l.href && !l.href.includes("?") && all.findIndex((x) => x.href === l.href) === i);

  return (
    <nav aria-label={t("categories")} className="scrollbar-none flex h-12 items-center gap-2 overflow-x-auto px-4 lg:hidden">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              active ? "border-navy bg-navy text-cream" : "border-navy/20 hover:border-navy",
            )}
          >
            {"icon" in l && l.icon && <NavIcon name={l.icon} size={16} />}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Admin shell: banner, top bar (logo + Admin, View store ↗, Log out) and the
 * same mega menu as the shop (lib/navigation.ts), pointed at admin URLs.
 */
export function AdminLayout() {
  const t = useT("admin.topbar");
  const tc = useT("common");
  const banner = useT("admin");
  const pathname = usePathname();
  // The product form has the switcher in its sticky status bar; every other admin page gets it here
  const formPage = pathname.startsWith("/admin/products/");
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    setLeaving(true);
    try {
      await adminApi.logout();
    } finally {
      // Full reload so no admin data stays in memory
      window.location.assign("/admin/login");
    }
  };

  return (
    <div
      className="theme-cream flex min-h-dvh flex-col"
      // Header is 56px (top bar) + 48px (menu row): the catalog toolbar sticks below it
      style={{ "--toolbar-top": "104px", "--toolbar-top-lg": "104px" } as React.CSSProperties}
    >
      <meta name="robots" content="noindex, nofollow" />
      <p className="bg-accent-soft px-4 py-1.5 text-center text-xs text-accent">{banner("banner")}</p>

      <header className="sticky top-0 z-40 border-b border-navy/10 bg-cream/95 text-navy backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-5 lg:px-8">
          <Logo href="/admin" size="sm" />
          <span className="rounded-xs bg-navy px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream max-sm:hidden">{t("badge")}</span>
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
            {!formPage && <AdminLanguageSwitcher />}
            <AdminHomeLink />
            <Link
              href="/admin/orders"
              aria-current={pathname === "/admin/orders" ? "page" : undefined}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-sm hover:underline hover:underline-offset-4 aria-[current=page]:underline aria-[current=page]:underline-offset-4"
            >
              <Package className="size-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="max-md:sr-only">{t("orders")}</span>
            </Link>
            <a href="/" target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1 rounded-sm px-2 text-sm hover:underline hover:underline-offset-4">
              <span className="max-md:sr-only">{t("viewStore")}</span> <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">{tc("opensInNewTab")}</span>
            </a>
            <button
              type="button"
              onClick={logout}
              disabled={leaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-navy/30 px-3 text-sm transition-colors hover:border-navy hover:bg-navy hover:text-cream"
            >
              {leaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" strokeWidth={1.5} aria-hidden="true" />}
              <span className="max-sm:sr-only">{t("logOut")}</span>
            </button>
          </div>
        </div>
        <div className="border-t border-navy/10">
          <NavHrefProvider value={adminHref}>
            <MegaMenu className="mx-auto hidden h-12 max-w-[1440px] items-center justify-center lg:flex" />
          </NavHrefProvider>
          <MobileCategoryNav />
        </div>
      </header>

      <main id="main" className="flex-1 pb-28">
        <Outlet />
      </main>
    </div>
  );
}
