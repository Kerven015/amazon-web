import { Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { AdminCardProvider, type AdminCardApi } from "@/components/admin/admin-card-context";
import { DeleteDialog } from "@/components/admin/delete-products";
import { CollectionView } from "@/components/collection/collection-view";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { searchKey, useLocale, useT } from "@/i18n";
import { displayRecord, ensureCatalog, listProducts, listRecords } from "@/lib/catalog";
import { hasMissing, localizeProduct, searchableText, translatedLocales } from "@/lib/localize";
import { getCollectionDef } from "@/lib/collections";
import { siteConfig } from "@/lib/config";
import { Link, notFound, usePathname, useRouter, useSearchParams } from "@/lib/router";
import { cn } from "@/lib/utils";
import type { Product, TranslatedLocale } from "@/types";

type MissingKey = "any" | TranslatedLocale;
const MISSING_OPTIONS: MissingKey[] = ["any", ...translatedLocales];

/** Language names are lower-case in Russian; chips start with a capital. */
const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

export const LAST_CATALOG_KEY = "vendora-admin-last-catalog";

/** /admin (all products) and /admin/collections/:slug — same data rules as the public pages, plus hidden products. */
export async function adminCatalogLoader({ params }: LoaderFunctionArgs) {
  await ensureCatalog("admin");
  // Collection rules run on the English data; the page shows the products in the admin
  // language (records are localized while rendering, so switching language needs no reload).
  // Search matches every language.
  const all = listProducts({ includeHidden: true, locale: "en" });
  const records = listRecords({ includeHidden: true });
  // Product ids with empty translations: in any language, and per language
  const missing: Record<MissingKey, string[]> = {
    any: records.filter((r) => hasMissing(r)).map((r) => r.id),
    ...(Object.fromEntries(translatedLocales.map((l) => [l, records.filter((r) => hasMissing(r, l)).map((r) => r.id)])) as Record<TranslatedLocale, string[]>),
  };
  const haystack = Object.fromEntries(records.map((r) => [r.id, searchKey(searchableText(r))]));
  const byId = new Map(records.map((r) => [r.id, r]));
  const recordsFor = (list: Product[]) => list.map((p) => byId.get(p.id)!).filter(Boolean);
  if (!params.slug) return { slug: null, records: recordsFor(all), missing, haystack };
  const def = getCollectionDef(params.slug);
  if (!def) notFound();
  return { slug: def.slug, records: recordsFor(all.filter(def.match)), missing, haystack };
}

/** Search by name (any language), SKU or colour — accent-insensitive. */
function matchesSearch(p: Product, q: string, haystack: Record<string, string>) {
  const hay = `${haystack[p.id] ?? ""} ${searchKey([p.id, p.slug].join(" "))}`;
  return searchKey(q)
    .split(" ")
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

function AdminSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT("admin.catalog");
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  // Debounce URL updates while typing
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), 250);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);

  return (
    <div className="mx-auto mb-8 max-w-xl">
      <label htmlFor="admin-search" className="sr-only">{t("searchLabel")}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <input
          id="admin-search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-12 w-full rounded-full border border-input bg-surface pl-11 pr-11 text-sm outline-none transition-colors focus:border-navy"
        />
        {draft && (
          <button type="button" onClick={() => onChange("")} aria-label={t("clearSearch")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted">
            <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminCatalogPage() {
  const { slug, records, missing, haystack } = useLoaderData<typeof adminCatalogLoader>();
  const t = useT("admin.catalog");
  const tl = useT("admin.languages");
  const tc = useT("collections");
  const locale = useLocale();
  const products = useMemo(() => records.map((r) => localizeProduct(displayRecord(r), locale)), [records, locale]);
  const title = slug ? tc(`${slug}.title`) : t("allTitle");
  const intro = slug ? tc(`${slug}.intro`) : t("allIntro");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const find = searchParams.get("find") ?? "";
  // ?missing=1 (any language) or ?missing=tr|tk|ru
  const missingParam = searchParams.get("missing");
  const missingFilter: MissingKey | null = missingParam === "1" ? "any" : MISSING_OPTIONS.includes(missingParam as MissingKey) ? (missingParam as MissingKey) : null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<Product[] | null>(null);

  // Remember where we were so Save / Cancel on the edit page come back here
  useEffect(() => {
    try {
      sessionStorage.setItem(LAST_CATALOG_KEY, pathname + (searchParams.toString() ? `?${searchParams}` : ""));
    } catch {
      /* ignore */
    }
  }, [pathname, searchParams]);

  // Selection only covers products that still exist
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(products.map((p) => p.id));
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [products]);

  const missingSets = useMemo(
    () => Object.fromEntries(MISSING_OPTIONS.map((k) => [k, new Set(missing[k])])) as Record<MissingKey, Set<string>>,
    [missing],
  );
  const filtered = useMemo(
    () => products.filter((p) => (!find || matchesSearch(p, find, haystack)) && (!missingFilter || missingSets[missingFilter].has(p.id))),
    [products, find, haystack, missingFilter, missingSets],
  );
  const countHere = (key: MissingKey) => products.filter((p) => missingSets[key].has(p.id)).length;

  const toggleMissing = (key: MissingKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (missingFilter === key) params.delete("missing");
    else params.set("missing", key === "any" ? "1" : key);
    params.delete("show");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const setFind = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set("find", v);
    else params.delete("find");
    params.delete("show");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const newHref = `/admin/products/new${slug ? `?collection=${slug}` : ""}`;

  const api: AdminCardApi = useMemo(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((s) => {
          const next = new Set(s);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      editHref: (p) => `/admin/products/${p.id}/edit`,
      remove: (p) => setToDelete([p]),
    }),
    [selected],
  );

  return (
    <Container>
      <title>{t("pageTitle", { title, store: siteConfig.name })}</title>
      <AdminCardProvider value={api}>
        <CollectionView
          key={slug ?? "all"}
          products={filtered}
          title={title}
          intro={intro}
          crumbs={[{ label: t("crumb"), href: "/admin" }, ...(slug ? [{ label: title }] : [])]}
          allHref="/admin"
          search={
            <>
              <AdminSearch value={find} onChange={setFind} />
              <div className="-mt-4 mb-8 flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t("missingLabel")}>
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-[#d97706]" aria-hidden="true" />
                  {t("missingLabel")}
                </span>
                {MISSING_OPTIONS.map((key) => {
                  const on = missingFilter === key;
                  const n = countHere(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleMissing(key)}
                      disabled={!n && !on}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50",
                        on ? "border-navy bg-navy text-cream" : "border-navy/20 hover:border-navy",
                      )}
                    >
                      {key === "any" ? t("missingAny") : capitalize(tl(key), locale)}
                      <span className="tabular-nums opacity-70">{n}</span>
                      {on && <X className="size-3.5" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </>
          }
          toolbarEnd={
            <Button asChild size="sm">
              <Link href={newHref}>
                <Plus aria-hidden="true" />
                {/* Icon only on phones (long labels in Russian/Turkmen); the label stays for screen readers */}
                <span className="sr-only sm:not-sr-only">{t("addProduct")}</span>
              </Link>
            </Button>
          }
          emptyState={
            find ? undefined : (
              <div className="mx-auto max-w-md py-20 text-center">
                <h2 className="text-3xl">{t("emptyTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("emptyBody")}</p>
                <Button asChild className="mt-6">
                  <Link href={newHref}>
                    <Plus aria-hidden="true" /> {t("addProduct")}
                  </Link>
                </Button>
              </div>
            )
          }
        />
      </AdminCardProvider>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: "120%" }}
            animate={{ y: 0 }}
            exit={{ y: "120%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
            role="region"
            aria-label={t("bulkLabel")}
          >
            <div className="flex items-center gap-4 rounded-full bg-navy px-5 py-2.5 text-sm text-cream shadow-pop">
              <span aria-live="polite">{t("selected", { count: selected.size })}</span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <button type="button" onClick={() => setToDelete(products.filter((p) => selected.has(p.id)))} className="font-medium text-[#ffb4a2] hover:underline">
                {t("deleteSelected")}
              </button>
              <span aria-hidden="true" className="opacity-40">·</span>
              <button type="button" onClick={() => setSelected(new Set())} className="hover:underline">
                {t("clearSelection")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteDialog
        products={toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onDeleted={(ids) => setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))))}
      />
    </Container>
  );
}
