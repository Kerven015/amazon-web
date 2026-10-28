import { Ban, LoaderCircle, LogOut, Monitor, RefreshCw, Search, Smartphone, Trash2, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { ClearHistoryButton } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { statusMeta } from "@/components/account/account-view";
import { formatDate, formatPrice, useLocale, useT, type Locale } from "@/i18n";
import { type AdminCustomer, type AdminCustomerDetail, adminApi, ApiError } from "@/lib/admin-api";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import { ADMIN_BASE } from "@/lib/admin-path";

export async function adminCustomersLoader() {
  return { customers: await adminApi.customers() };
}

type Filter = "all" | "signedIn" | "active" | "blocked";
const FILTERS: Filter[] = ["all", "signedIn", "active", "blocked"];
/** The list refreshes itself so "Active now" stays current */
const REFRESH_MS = 30_000;

/** "3 min ago" / "2 days ago" in the admin's language */
function ago(iso: string | null, locale: Locale) {
  if (!iso) return "—";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, secs] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) {
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  }
  return rtf.format(0, "minute");
}

/** "Chrome on Windows" from a user-agent string (good enough for telling devices apart) */
function device(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 40) || "?", mobile: /iPhone|Android|Mobile/.test(ua) };
}

/** Green dot = active in the last 10 minutes; grey = signed in; none = signed out / blocked */
function StatusCell({ c }: { c: AdminCustomer }) {
  const t = useT("admin.customers");
  if (c.blocked) return <Badge variant="danger">{t("blocked")}</Badge>;
  if (!c.sessions) return <span className="text-muted-foreground">{t("signedOut")}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", c.activeNow ? "bg-success" : "bg-muted-foreground/50")} aria-hidden="true" />
      {c.activeNow ? t("activeNow") : t("signedIn")}
      <span className="text-xs text-muted-foreground">· {t("devices", { count: c.sessions })}</span>
    </span>
  );
}

/** "Google" / "Password" chips: how the customer signs in */
function SignInMethods({ methods }: { methods: AdminCustomer["methods"] }) {
  const t = useT("admin.customers.methods");
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {methods.map((m) => (
        <span key={m} className="rounded-xs border px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
          {t(m)}
        </span>
      ))}
    </span>
  );
}

/** /admin/customers — every customer account, who's signed in, and sign out / block / delete. */
export default function AdminCustomersPage() {
  const t = useT("admin.customers");
  const locale = useLocale();
  const [customers, setCustomers] = useState<AdminCustomer[]>(useLoaderData<typeof adminCustomersLoader>().customers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setCustomers(await adminApi.customers());
    } catch {
      /* keep what's on screen; the next refresh tries again */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const counts = useMemo(
    () => ({
      all: customers.length,
      signedIn: customers.filter((c) => c.sessions > 0).length,
      active: customers.filter((c) => c.activeNow).length,
      blocked: customers.filter((c) => c.blocked).length,
    }),
    [customers],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (filter === "all" || (filter === "signedIn" && c.sessions > 0) || (filter === "active" && c.activeNow) || (filter === "blocked" && c.blocked)) &&
        (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)),
    );
  }, [customers, query, filter]);

  /** After an action in the side panel: update that row (or drop it when deleted) */
  const onChange = (id: string, next: AdminCustomer | null) => setCustomers((list) => (next ? list.map((c) => (c.id === id ? { ...c, ...next } : c)) : list.filter((c) => c.id !== id)));

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClearHistoryButton what="customers" onCleared={refresh} />
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} aria-hidden="true" /> {t("refresh")}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                filter === f ? "border-navy bg-navy text-cream" : "border-navy/20 hover:border-navy",
              )}
            >
              {t(`filters.${f}`)} <span className="opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-sm border bg-card p-10 text-center text-sm text-muted-foreground">{customers.length ? t("noMatch") : t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border bg-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t("customer")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("status")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("lastSeen")}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t("joined")}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t("orders")}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t("spent")}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t("actions")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((c) => (
                <tr key={c.id} className={cn(c.blocked && "bg-danger-soft/40")}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.email}</span>
                    <SignInMethods methods={c.methods} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3"><StatusCell c={c} /></td>
                  <td className="whitespace-nowrap px-4 py-3">{c.sessions ? ago(c.lastSeen, locale) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(c.createdAt, undefined, locale)}</td>
                  <td className="px-4 py-3 text-right">{c.orders}</td>
                  <td className="price whitespace-nowrap px-4 py-3 text-right">{formatPrice(c.spent, locale)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)} aria-label={t("manageNamed", { name: c.name })}>
                      {t("manage")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerSheet id={openId} onClose={() => setOpenId(null)} onChange={onChange} />
    </Container>
  );
}

/** Side panel: details, signed-in devices, and the admin's actions. */
function CustomerSheet({ id, onClose, onChange }: { id: string | null; onClose: () => void; onChange: (id: string, next: AdminCustomer | null) => void }) {
  const t = useT("admin.customers");
  const ts = useT("orders.status");
  const locale = useLocale();
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return setDetail(null);
    let live = true;
    adminApi.customer(id).then(
      (d) => live && setDetail(d),
      () => live && (toast.error(t("failed")), onClose()),
    );
    return () => {
      live = false;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs an action, shows a toast, and updates the panel + the list row */
  const run = async (key: string, action: () => Promise<AdminCustomerDetail | null>, done: string) => {
    if (!detail) return;
    setBusy(key);
    try {
      const next = await action();
      setDetail(next);
      onChange(detail.id, next);
      toast.success(done);
      if (!next) onClose();
    } catch (err) {
      toast.error(err instanceof ApiError && err.message === "has_orders" ? t("hasOrders") : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const d = detail;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={d?.name ?? t("title")} bodyClassName="px-5 py-5 sm:px-6">
        {!d ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {t("loading")}
          </p>
        ) : (
          <div className="space-y-6 text-sm">
            <section>
              <p className="break-all font-medium">{d.email}</p>
              <SignInMethods methods={d.methods} />
              <div className="mt-2"><StatusCell c={d} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">{t("joined")}</dt>
                <dd>{formatDate(d.createdAt, undefined, locale)}</dd>
                <dt className="text-muted-foreground">{t("language")}</dt>
                <dd className="uppercase">{d.locale}</dd>
                <dt className="text-muted-foreground">{t("orders")}</dt>
                <dd>{d.orders} · <span className="price">{formatPrice(d.spent, locale)}</span></dd>
                <dt className="text-muted-foreground">{t("addresses")}</dt>
                <dd>{d.addresses}</dd>
                <dt className="text-muted-foreground">{t("reviews")}</dt>
                <dd>{d.reviews}</dd>
              </dl>
            </section>

            <section>
              <h2 className="mb-2 font-semibold">{t("devicesTitle")}</h2>
              {d.sessionList.length === 0 ? (
                <p className="text-muted-foreground">{d.blocked ? t("blockedNoDevices") : t("noDevices")}</p>
              ) : (
                <ul className="divide-y rounded-sm border">
                  {d.sessionList.map((s) => {
                    const dev = device(s.userAgent);
                    const Icon = dev.mobile ? Smartphone : Monitor;
                    return (
                      <li key={s.id} className="flex items-start gap-3 p-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {dev.label}
                            {s.activeNow && <span className="ml-2 text-xs font-normal text-success">● {t("activeNow")}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("sessionLine", { seen: ago(s.lastSeen, locale), since: formatDate(s.createdAt, undefined, locale), ip: s.ip || "—" })}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.remember ? t("remembered") : t("browserSession")}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!busy}
                          aria-label={t("endSessionNamed", { device: dev.label })}
                          onClick={() => run(`s-${s.id}`, () => adminApi.endSession(d.id, s.id), t("sessionEnded"))}
                        >
                          {busy === `s-${s.id}` ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {d.recentOrders.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">{t("recentOrders")}</h2>
                <ul className="divide-y rounded-sm border">
                  {d.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 p-3">
                      <span>
                        <span className="font-medium">{o.id}</span> <span className="text-xs text-muted-foreground">· {formatDate(o.createdAt, undefined, locale)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={statusMeta[o.status as OrderStatus].variant}>{ts(o.status)}</Badge>
                        <span className="price">{formatPrice(o.total, locale)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href={`${ADMIN_BASE}/orders`} className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-navy hover:underline">
                  {t("allOrders")}
                </Link>
              </section>
            )}

            <section className="space-y-2 border-t pt-5">
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={!!busy || d.sessions === 0}
                onClick={() => run("signout", async () => (await adminApi.signOutCustomer(d.id), adminApi.customer(d.id)), t("signedOutToast", { name: d.name }))}
              >
                {busy === "signout" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />} {t("signOutAll")}
              </Button>
              {d.blocked ? (
                <Button variant="outline" className="w-full justify-start" disabled={!!busy} onClick={() => run("block", () => adminApi.setBlocked(d.id, false), t("unblockedToast", { name: d.name }))}>
                  {busy === "block" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <UserCheck aria-hidden="true" />} {t("unblock")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start text-danger"
                  disabled={!!busy}
                  onClick={() => window.confirm(t("confirmBlock", { name: d.name })) && run("block", () => adminApi.setBlocked(d.id, true), t("blockedToast", { name: d.name }))}
                >
                  {busy === "block" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Ban aria-hidden="true" />} {t("block")}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start text-danger"
                disabled={!!busy || d.orders > 0}
                aria-describedby={d.orders > 0 ? "delete-note" : undefined}
                onClick={() => window.confirm(t("confirmDelete", { name: d.name, email: d.email })) && run("delete", async () => (await adminApi.deleteCustomer(d.id), null), t("deletedToast", { name: d.name }))}
              >
                {busy === "delete" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} {t("delete")}
              </Button>
              {d.orders > 0 && (
                <p id="delete-note" className="text-xs text-muted-foreground">
                  {t("hasOrders")}
                </p>
              )}
              <p className="pt-2 text-xs text-muted-foreground">{t("privacyNote")}</p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
