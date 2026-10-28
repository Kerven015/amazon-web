import { ArrowUpRight, BarChart3, Boxes, ChevronDown, History, LayoutDashboard, LoaderCircle, LogOut, Mail, MessageSquareText, MonitorX, Package, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { Outlet, redirect, useNavigate, type LoaderFunctionArgs } from "react-router";
import { toast } from "@/components/ui/toaster";
import { Logo } from "@/components/layout/logo";
import { MegaMenu, NavHrefProvider, useNavText } from "@/components/layout/mega-menu";
import { AdminLanguageSwitcher } from "@/components/admin/admin-i18n";
import { useT } from "@/i18n";
import { adminApi, type Notifications, type Section } from "@/lib/admin-api";
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

/** The admin's tool pages (the "Manage" menu in the top bar); `section` = has "new" notifications */
const TOOLS: { href: string; key: string; Icon: typeof Package; section?: Section }[] = [
  { href: "/admin/dashboard", key: "dashboard", Icon: LayoutDashboard },
  { href: "/admin/orders", key: "orders", Icon: Package, section: "orders" },
  { href: "/admin/customers", key: "customers", Icon: Users, section: "customers" },
  { href: "/admin/inventory", key: "inventory", Icon: Boxes, section: "inventory" },
  { href: "/admin/reviews", key: "reviews", Icon: MessageSquareText, section: "reviews" },
  { href: "/admin/newsletter", key: "newsletter", Icon: Mail },
  { href: "/admin/reports", key: "reports", Icon: BarChart3 },
  { href: "/admin/activity", key: "activity", Icon: History },
];

/** How often the menu checks for news (only while the tab is visible) */
const POLL_MS = 30_000;

/**
 * What's new in each section since the admin last opened it. Opening a section resets its
 * count; when a count goes up while the admin is working, a message pops up with a link.
 */
function useNotifications() {
  const t = useT("admin.notifications");
  const pathname = usePathname();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Notifications | null>(null);
  const previous = useRef<Notifications | null>(null);
  const here = TOOLS.find((x) => x.href === pathname)?.section;
  // The polling effect outlives renders: read the current language through a ref
  const tRef = useRef(t);
  tRef.current = t;

  const update = (next: Notifications) => {
    const before = previous.current;
    if (before) {
      for (const tool of TOOLS) {
        const s = tool.section;
        if (!s || s === here) continue;
        const added = next[s] - before[s];
        if (added > 0) toast.info(tRef.current(s, { count: added }), { action: { label: tRef.current("open"), onClick: () => navigate(tool.href) } });
      }
    }
    previous.current = next;
    setCounts(next);
  };

  useEffect(() => {
    let live = true;
    const load = () => (here ? adminApi.markSeen(here) : adminApi.notifications()).then((n) => live && update(n), () => {});
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [here]); // eslint-disable-line react-hooks/exhaustive-deps

  return counts;
}

/** Small count bubble ("9+" above 9) */
function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return <span className={cn("inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-[18px] text-accent-foreground", className)}>{count > 9 ? "9+" : count}</span>;
}

function ManageMenu() {
  const t = useT("admin.topbar");
  const tn = useT("admin.notifications");
  const pathname = usePathname();
  const current = TOOLS.find((x) => pathname === x.href);
  const counts = useNotifications();
  const total = counts ? TOOLS.reduce((n, x) => n + (x.section ? counts[x.section] : 0), 0) : 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-current={current ? "page" : undefined}
        className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-sm hover:underline hover:underline-offset-4 aria-[current=page]:underline aria-[current=page]:underline-offset-4"
      >
        {current ? <current.Icon className="size-4" strokeWidth={1.5} aria-hidden="true" /> : <LayoutDashboard className="size-4" strokeWidth={1.5} aria-hidden="true" />}
        <span className="max-md:sr-only">{current ? t(current.key) : t("manage")}</span>
        <CountBadge count={total} />
        {total > 0 && <span className="sr-only">{tn("total", { count: total })}</span>}
        <ChevronDown className="size-3.5 max-sm:hidden" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TOOLS.map(({ href, key, Icon, section }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href} aria-current={pathname === href ? "page" : undefined} className="aria-[current=page]:font-semibold">
              <Icon aria-hidden="true" /> {t(key)}
              {section && counts?.[section] ? (
                <span className="ml-auto pl-4">
                  <CountBadge count={counts[section]} />
                  <span className="sr-only">{tn(section, { count: counts[section] })}</span>
                </span>
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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

  /** Ends the session on the server (or every admin session), then reloads the login page */
  const logout = async (everywhere = false) => {
    if (everywhere && !window.confirm(t("logOutAllConfirm"))) return;
    setLeaving(true);
    try {
      await (everywhere ? adminApi.logoutAll() : adminApi.logout());
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
            <ManageMenu />
            <a href="/" target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1 rounded-sm px-2 text-sm hover:underline hover:underline-offset-4">
              <span className="max-md:sr-only">{t("viewStore")}</span> <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">{tc("opensInNewTab")}</span>
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={leaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-navy/30 px-3 text-sm transition-colors hover:border-navy hover:bg-navy hover:text-cream max-sm:px-2"
              >
                {leaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                <span className="max-sm:sr-only">{t("logOut")}</span>
                <ChevronDown className="size-3.5 max-sm:hidden" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut aria-hidden="true" /> {t("logOutHere")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void logout(true)}>
                  <MonitorX aria-hidden="true" /> {t("logOutAll")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
