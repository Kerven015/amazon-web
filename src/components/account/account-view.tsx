import { Heart, LoaderCircle, LogOut, MapPin, Package, Pencil, Plus, Star, Trash2, User } from "lucide-react";
import { Link } from "@/lib/router";
import { usePathname, useRouter, useSearchParams } from "@/lib/router";
import { useEffect, useRef, useState } from "react";
import { AnimatedBackground } from "@/components/motion-ui/animated-background";
import { TransitionPanel } from "@/components/motion-ui/transition-panel";
import { ProductGrid } from "@/components/product/product-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/lib/store/wishlist";
import { cn, formatDate, formatPrice, initials } from "@/lib/utils";
import type { Order, OrderStatus, Product, User as UserType } from "@/types";
import { ProductImage } from "@/components/product/product-image";
import { useLocale, useT } from "@/i18n";
import { getProductById } from "@/lib/catalog";
import { addressLabel, addressLine, countryName, statusLabel } from "@/lib/order-format";
import { validateEmail } from "@/components/layout/newsletter";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useAddressBook } from "@/lib/store/addresses";
import { AccountApiError, accountApi, accountErrorMessage } from "@/lib/account-api";
import { PASSWORD_MIN } from "@/lib/account-schema";
import { signOut, updateSessionUser, useSession } from "@/lib/session";
import type { Address } from "@/types";
import { AddressSheet } from "./address-sheet";

/** Tab labels: messages → account.tabs.{id} */
const TABS = [
  { id: "orders", icon: Package },
  { id: "wishlist", icon: Heart },
  { id: "addresses", icon: MapPin },
  { id: "profile", icon: User },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Status badge colour; the label comes from messages → orders.status.{status} */
export const statusMeta: Record<OrderStatus, { variant: "default" | "success" | "warning" | "danger" | "neutral" }> = {
  placed: { variant: "neutral" },
  packed: { variant: "warning" },
  shipped: { variant: "default" },
  out_for_delivery: { variant: "default" },
  delivered: { variant: "success" },
  cancelled: { variant: "danger" },
};

export function AccountView({ user, orders, products }: { user: UserType; orders: Order[]; products: Product[] }) {
  const router = useRouter();
  const t = useT("account");
  const locale = useLocale();
  const nameOf = (i: { productId: string; title: string }) => getProductById(i.productId, { includeHidden: true, locale })?.title ?? i.title;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: TabId = TABS.some((x) => x.id === raw) ? (raw as TabId) : "orders";
  const index = TABS.findIndex((x) => x.id === tab);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const allOrders = orders;
  const wishlistIds = useWishlist((s) => s.ids);
  const wishlist = wishlistIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  const profileName = useSession((s) => s.user?.name) || user.name;

  const setTab = (id: string) => router.replace(`${pathname}?tab=${id}`, { scroll: false });

  /** Tabs pattern: arrow keys move between tabs (and select them), Home/End jump to the ends. */
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const last = TABS.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const panel = (id: TabId) => ({ role: "tabpanel" as const, id: `account-panel-${id}`, "aria-labelledby": `account-tab-${id}`, tabIndex: -1 });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4">
        <div className="flex items-center gap-3 rounded-sm border bg-card p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy text-sm font-semibold text-cream" aria-hidden="true">
            {initials(profileName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{profileName}</p>
            <p className="truncate text-xs text-muted-foreground">{t("memberSince", { date: formatDate(user.memberSince, { day: undefined }) })}</p>
          </div>
        </div>
        <div role="tablist" aria-label={t("sections")} aria-orientation="horizontal" className="scrollbar-none flex gap-1 overflow-x-auto rounded-sm border bg-card p-2 lg:flex-col">
          <AnimatedBackground value={tab} className="rounded-sm bg-cream">
            {TABS.map((x, i) => (
              <button
                key={x.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                data-id={x.id}
                id={`account-tab-${x.id}`}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                aria-controls={`account-panel-${x.id}`}
                tabIndex={tab === x.id ? 0 : -1}
                onClick={() => setTab(x.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  "flex min-h-10 shrink-0 items-center rounded-sm px-3 py-2 text-left text-sm font-medium",
                  tab === x.id ? "text-navy" : "text-foreground/80 hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <x.icon className="size-4" aria-hidden="true" /> {t(`tabs.${x.id}`)}
                  {x.id === "wishlist" && wishlist.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{wishlist.length}</span>
                  )}
                </span>
              </button>
            ))}
          </AnimatedBackground>
        </div>
      </aside>

      <div className="min-w-0">
        <TransitionPanel activeIndex={index}>
          {/* Orders */}
          <section {...panel("orders")}>
            <h1 className="mb-4 text-4xl text-balance [overflow-wrap:anywhere]">{t("yourOrders")}</h1>
            {allOrders.length === 0 ? (
              <EmptyState icon={Package} title={t("noOrders")} body={t("noOrdersHint")} cta={t("startShopping")} />
            ) : (
              <ul className="space-y-4">
                {allOrders.map((o) => (
                  <li key={o.id} className="overflow-hidden rounded-sm border bg-card">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-muted/50 px-4 py-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t("orderPlaced")}</p>
                        <p className="font-semibold">{formatDate(o.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("total")}</p>
                        <p className="price font-semibold">{formatPrice(o.total)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground">{t("shipTo")}</p>
                        <p className="truncate font-semibold">
                          {o.address.fullName}, {o.address.city}, {countryName(o.address.country)}
                        </p>
                      </div>
                      <p className="ml-auto text-muted-foreground">
                        {t("orderNumber")} <span className="font-semibold text-foreground">{o.id}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1 space-y-3">
                        <Badge variant={statusMeta[o.status].variant}>{statusLabel(o.status)}</Badge>
                        <ul className="flex flex-wrap gap-2">
                          {o.items.map((i) => (
                            <li key={`${i.productId}-${i.variant?.color ?? ""}-${i.variant?.size ?? ""}`} className="relative size-14 overflow-hidden rounded-sm border bg-cream">
                              <ProductImage src={i.image || getProductById(i.productId, { includeHidden: true, locale })?.images[0]?.src || ""} alt={nameOf(i)} sizes="56px" iconClassName="size-4" />
                            </li>
                          ))}
                        </ul>
                        <p className="line-clamp-1 text-sm">{o.items.map(nameOf).join(", ")}</p>
                      </div>
                      <Button asChild className="shrink-0">
                        <Link href={`/account/orders/${o.id}`} aria-label={t("viewOrderNamed", { id: o.id })}>
                          {t("viewOrder")}
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Wishlist */}
          <section {...panel("wishlist")}>
            <h1 className="mb-4 text-4xl text-balance [overflow-wrap:anywhere]">{t("tabs.wishlist")}</h1>
            {wishlist.length === 0 ? (
              <EmptyState icon={Heart} title={t("wishlistEmpty")} body={t("wishlistHint")} cta={t("discover")} />
            ) : (
              <ProductGrid products={wishlist} className="-mx-1.5 lg:grid-cols-3 2xl:grid-cols-4" />
            )}
          </section>

          {/* Addresses */}
          <section {...panel("addresses")}>
            <h1 className="mb-4 text-4xl text-balance [overflow-wrap:anywhere]">{t("tabs.addresses")}</h1>
            <AddressBook />
          </section>

          {/* Profile */}
          <section {...panel("profile")} className="max-w-xl">
            <h1 className="mb-4 text-4xl text-balance [overflow-wrap:anywhere]">{t("tabs.profile")}</h1>
            <ProfileDetails user={user} />
          </section>
        </TransitionPanel>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, cta }: { icon: typeof Heart; title: string; body: string; cta: string }) {
  return (
    <div className="rounded-sm border bg-card p-10 text-center">
      <Icon className="mx-auto size-10 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-4">
        <Link href="/">{cta}</Link>
      </Button>
    </div>
  );
}

/** Saved addresses with working Edit / Remove (with undo) / Set as default; "Add address" comes last. */
function AddressBook() {
  const t = useT("account");
  const addresses = useAddressBook((s) => s.addresses);
  const remove = useAddressBook((s) => s.remove);
  const setDefault = useAddressBook((s) => s.setDefault);
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);

  const openSheet = (a: Address | null) => {
    setEditing(a);
    setOpen(true);
  };

  const removeWithUndo = async (a: Address) => {
    try {
      await remove(a.id);
    } catch (err) {
      return toast.error(accountErrorMessage(err));
    }
    const { id: _id, isDefault, ...rest } = a;
    toast(t("addressRemoved"), {
      // Undo saves it again (as a new entry in the account)
      action: { label: t("undo"), onClick: () => void useAddressBook.getState().add(rest, !!isDefault).catch((err) => toast.error(accountErrorMessage(err))) },
    });
  };

  const action = "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-2 -mx-2 text-xs font-semibold text-navy hover:underline";

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {addresses.map((a) => (
          <li key={a.id} className="flex flex-col rounded-sm border bg-card p-4 text-sm [overflow-wrap:anywhere]">
            <div className="mb-2 flex min-h-6 flex-wrap items-center gap-2">
              {a.label && <span className="font-semibold">{addressLabel(a)}</span>}
              {a.isDefault && <Badge>{t("default")}</Badge>}
            </div>
            <p className="font-medium">{a.fullName}</p>
            <p className="text-muted-foreground">{addressLine(a)}</p>
            <p className="text-muted-foreground">{countryName(a.country)}</p>
            <p className="mt-1 text-muted-foreground">{a.phone}</p>
            <div className="mt-auto flex flex-wrap gap-x-4 pt-3">
              <button type="button" className={action} onClick={() => openSheet(a)} aria-label={t("editAddress", { name: a.fullName })}>
                <Pencil className="size-3.5" aria-hidden="true" /> {t("edit")}
              </button>
              <button type="button" className={action} onClick={() => removeWithUndo(a)} aria-label={t("removeAddress", { name: a.fullName })}>
                <Trash2 className="size-3.5" aria-hidden="true" /> {t("remove")}
              </button>
              {!a.isDefault && (
                <button
                  type="button"
                  className={action}
                  onClick={() =>
                    setDefault(a.id).then(
                      () => toast.success(t("defaultUpdated")),
                      (err) => toast.error(accountErrorMessage(err)),
                    )
                  }
                >
                  <Star className="size-3.5" aria-hidden="true" /> {t("setDefault")}
                </button>
              )}
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => openSheet(null)}
            className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed text-sm font-semibold text-muted-foreground transition-colors hover:border-navy hover:text-navy"
          >
            <Plus className="size-6" aria-hidden="true" /> {t("addAddress")}
          </button>
        </li>
      </ul>
      <AddressSheet open={open} onOpenChange={setOpen} address={editing} />
    </>
  );
}

/**
 * Name and email, each editable in place (changing the email asks for the current password),
 * a password change, and "Sign out of all devices".
 */
function ProfileDetails({ user }: { user: UserType }) {
  const t = useT("account");
  const tc = useT("checkout");
  const router = useRouter();
  const session = useSession((s) => s.user);
  const values = { name: session?.name ?? user.name, email: session?.email ?? user.email };
  const [editing, setEditing] = useState<"name" | "email" | null>(null);
  const [draft, setDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // How this account signs in (Google, password, or both)
  const [methods, setMethods] = useState<{ hasPassword: boolean; google: boolean } | null>(null);
  useEffect(() => {
    accountApi.profile().then(
      (p) => setMethods({ hasPassword: p.hasPassword, google: p.google }),
      () => {},
    );
  }, []);

  const start = (f: "name" | "email") => {
    setEditing(f);
    setDraft(values[f]);
    setCurrentPassword("");
    setError(null);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    const err = editing === "email" ? validateEmail(v) : v ? null : tc("errors.required");
    setError(err);
    if (err || !editing) return;
    if (v === values[editing]) return setEditing(null);
    if (editing === "email" && !currentPassword) return setError(t("profile.passwordNeeded"));
    setSaving(true);
    try {
      const updated = await accountApi.updateProfile(editing === "email" ? { email: v, currentPassword } : { name: v });
      updateSessionUser({ name: updated.name, email: updated.email });
      setEditing(null);
      toast.success(t("profile.saved"));
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const signOutEverywhere = async () => {
    try {
      await signOut({ everywhere: true });
      toast(t("profile.signedOutEverywhere"));
      router.push("/");
    } catch (e) {
      toast.error(accountErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <dl className="divide-y rounded-sm border bg-card">
        {(["name", "email"] as const).map((f) => {
          const label = t(`profile.${f}`);
          const id = `profile-${f}`;
          return (
            <div key={f} className="p-4 text-sm">
              {editing === f ? (
                <form noValidate onSubmit={save} className="space-y-2">
                  <Label htmlFor={id} className="font-semibold">
                    {label}
                  </Label>
                  <Input
                    id={id}
                    type={f === "email" ? "email" : "text"}
                    autoComplete={f}
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                  {f === "email" && methods?.hasPassword !== false && (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor={`${id}-pw`}>{t("profile.currentPassword")}</Label>
                      <Input id={`${id}-pw`} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                  )}
                  {error && (
                    <p id={`${id}-error`} className="text-xs text-danger">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                      {t("profile.save")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t("profile.cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <dt className="font-semibold">{label}</dt>
                    <dd className="truncate text-muted-foreground">{values[f]}</dd>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => start(f)} aria-label={t("profile.editNamed", { field: label })}>
                    {t("edit")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </dl>

      {methods?.google && (
        <section className="flex items-center gap-3 rounded-sm border bg-card p-4 text-sm">
          <GoogleMark />
          <div className="min-w-0">
            <h2 className="font-semibold">{t("profile.googleTitle")}</h2>
            <p className="text-muted-foreground">{t("profile.googleBody")}</p>
          </div>
        </section>
      )}

      <PasswordChange hasPassword={methods?.hasPassword ?? true} onSet={() => setMethods((m) => (m ? { ...m, hasPassword: true } : m))} />

      <section className="rounded-sm border bg-card p-4 text-sm">
        <h2 className="font-semibold">{t("profile.devicesTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("profile.devicesBody")}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={signOutEverywhere}>
          <LogOut aria-hidden="true" /> {t("profile.signOutAll")}
        </Button>
      </section>
    </div>
  );
}

/** Google's "G" (shown next to "Signed in with Google") */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-6 shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Current + new password (other devices are signed out afterwards).
 * Accounts from "Continue with Google" have no password yet: they just set one.
 */
function PasswordChange({ hasPassword, onSet }: { hasPassword: boolean; onSet: () => void }) {
  const t = useT("account.profile");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPassword && !current) return setError(t("passwordNeeded"));
    if (next.length < PASSWORD_MIN) return setError(t("newPasswordShort"));
    setSaving(true);
    setError(null);
    try {
      await accountApi.changePassword({ currentPassword: hasPassword ? current : undefined, newPassword: next });
      toast.success(hasPassword ? t("passwordChanged") : t("passwordSet"));
      onSet();
      setOpen(false);
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(err instanceof AccountApiError && err.code === "validation" ? t("newPasswordShort") : accountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-sm border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{t("password")}</h2>
          {!open && <p className="text-muted-foreground">{hasPassword ? "••••••••" : t("noPassword")}</p>}
        </div>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {hasPassword ? t("changePassword") : t("setPassword")}
          </Button>
        )}
      </div>
      {open && (
        <form noValidate onSubmit={submit} className="mt-3 space-y-3">
          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">{t("currentPassword")}</Label>
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">{t("newPassword")}</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-hint" />
            <p id="pw-hint" className="text-xs text-muted-foreground">
              {t("newPasswordHint")}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
