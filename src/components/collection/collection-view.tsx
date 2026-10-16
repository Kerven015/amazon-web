import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Link } from "@/lib/router";
import { usePathname, useRouter, useSearchParams } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { CLOSE_OVERLAYS_EVENT } from "@/components/layout/home-link";
import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { InView } from "@/components/motion-ui/in-view";
import { type GridColumns, ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { iconFor } from "@/lib/navigation";
import { NavIcon } from "@/components/ui/nav-icon";
import { cn } from "@/lib/utils";
import type { Product, SortOption } from "@/types";
import { FilterDrawer } from "./filter-drawer";
import {
  type CollectionQuery,
  type MultiKey,
  PAGE_SIZE,
  activeFilterCount,
  applyQuery,
  clearFilters,
  multiKeys,
  parseQuery,
  serializeQuery,
  sortOptions,
} from "./query-state";
import { useFilterLabels } from "./filter-labels";
import { formatPriceShort, useT } from "@/i18n";

export type Crumb = { label: string; href?: string };

/**
 * Editorial collection page: breadcrumb, serif title + intro, quick-filter
 * chips, toolbar (filter / count / view / sort), grid, and "Show more".
 * All state is in the URL query string.
 */
export function CollectionView({
  products,
  title,
  intro,
  crumbs,
  search,
  toolbarEnd,
  emptyState,
  allHref = "/search",
}: {
  products: Product[];
  title: React.ReactNode;
  intro?: React.ReactNode;
  crumbs: Crumb[];
  /** Extra slot under the title (admin: product search) */
  search?: React.ReactNode;
  /** Extra controls at the right end of the toolbar (admin: "+ Add product") */
  toolbarEnd?: React.ReactNode;
  /** Shown instead of the grid when the collection has no products at all */
  emptyState?: React.ReactNode;
  /** "Shop all" target in the no-results state */
  allHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => parseQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const closeDrawer = () => setDrawerOpen(false);
    window.addEventListener(CLOSE_OVERLAYS_EVENT, closeDrawer);
    return () => window.removeEventListener(CLOSE_OVERLAYS_EVENT, closeDrawer);
  }, []);
  const t = useT("collection");
  const labels = useFilterLabels(products);

  const commit = (next: CollectionQuery) => {
    const params = serializeQuery(next, new URLSearchParams(searchParams.toString()));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const update = (patch: Partial<CollectionQuery>) => commit({ ...query, show: PAGE_SIZE, ...patch });

  const results = useMemo(() => applyQuery(products, query), [products, query]);
  const visible = results.slice(0, query.show);
  const activeCount = activeFilterCount(query);

  // Quick-filter chips
  const types = [...new Set(products.map((p) => p.productType))];
  const feels = [...new Set(products.map((p) => p.feel))];
  const chipBase =
    "shrink-0 rounded-full border px-4 py-2 text-[13px] transition-colors duration-300 ease-calm hover:border-foreground";
  const chipOn = "border-foreground bg-foreground text-background";

  // Active filter chips
  const chips: { label: string; clear: () => void }[] = [];
  multiKeys.forEach((k: MultiKey) =>
    query[k].forEach((v) =>
      chips.push({ label: labels.value(k, v), clear: () => update({ [k]: query[k].filter((x) => x !== v) }) }),
    ),
  );
  if (query.min !== undefined || query.max !== undefined)
    chips.push({
      label: t("priceChip", { min: formatPriceShort(query.min ?? 0), max: query.max !== undefined ? formatPriceShort(query.max) : t("any") }),
      clear: () => update({ min: undefined, max: undefined }),
    });
  if (query.fast) chips.push({ label: t("chips.fast"), clear: () => update({ fast: false }) });
  if (query.stock) chips.push({ label: t("chips.stock"), clear: () => update({ stock: false }) });
  if (query.sale) chips.push({ label: t("chips.sale"), clear: () => update({ sale: false }) });

  return (
    <div>
      {/* 1. Breadcrumb */}
      <nav aria-label={t("breadcrumb")} className="pt-5 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground hover:underline">{c.label}</Link>
              ) : (
                <span aria-current="page" className="text-foreground">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* 2. Title + intro */}
      <InView className="mx-auto max-w-2xl py-10 text-center sm:py-14">
        <h1 className="text-balance text-4xl leading-[1.05] [overflow-wrap:anywhere] hyphens-auto sm:text-6xl">{title}</h1>
        {intro && <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{intro}</p>}
      </InView>

      {search}

      {/* 3. Quick-filter chips */}
      {(types.length > 1 || feels.length > 1) && (
        // The scroller starts at the left edge; the inner row centres itself only when it fits
        // (mx-auto + w-max), so the first chip can always be scrolled to.
        <div className="scrollbar-none -mx-4 mb-8 overflow-x-auto px-4 lg:-mx-8 lg:px-8" data-testid="quick-chips">
          <div className="mx-auto flex w-max items-center gap-6">
          {types.length > 1 && (
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label={t("shopByProduct")}>
              <span className="eyebrow mr-1 shrink-0 text-muted-foreground">{t("shopByProduct")}</span>
              <button
                type="button"
                aria-pressed={!query.type.length}
                onClick={() => update({ type: [] })}
                className={cn(chipBase, !query.type.length && chipOn)}
              >
                {t("shopAll")}
              </button>
              {types.map((type) => {
                const on = query.type.length === 1 && query.type[0] === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ type: on ? [] : [type] })}
                    className={cn(chipBase, "inline-flex items-center gap-1.5", on && chipOn)}
                  >
                    {iconFor(type) && <NavIcon name={iconFor(type)!} size={16} />}
                    {labels.value("type", type)}
                  </button>
                );
              })}
            </div>
          )}
          {feels.length > 1 && (
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label={t("shopByFeeling")}>
              <span className="eyebrow mr-1 shrink-0 text-muted-foreground">{t("shopByFeeling")}</span>
              {feels.map((f) => {
                const on = query.feel.length === 1 && query.feel[0] === f;
                return (
                  <button key={f} type="button" aria-pressed={on} onClick={() => update({ feel: on ? [] : [f] })} className={cn(chipBase, on && chipOn)}>
                    {labels.value("feel", f)}
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {/* 4. Toolbar */}
      <div className="sticky top-[var(--toolbar-top,3.5rem)] z-20 -mx-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y bg-background/95 px-4 py-3 backdrop-blur-md lg:top-[var(--toolbar-top-lg,4rem)] lg:-mx-8 lg:px-8">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 text-sm font-medium"
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {t("filter")}
          {activeCount > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-foreground text-[10px] text-background">{activeCount}</span>
          )}
        </button>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          <AnimatedNumber value={results.length} className="text-foreground" /> {t("resultsSuffix", { count: results.length })}
        </p>

        <div className="ml-auto flex items-center gap-5">
          <div role="group" aria-label={t("gridColumns")} className="hidden items-center gap-1 lg:flex">
            {([2, 3, 4] as GridColumns[]).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t("columns", { count: n })}
                aria-pressed={query.view === n}
                onClick={() => commit({ ...query, view: n })}
                className={cn(
                  "flex h-8 items-center gap-[3px] rounded-xs px-1.5 transition-colors",
                  query.view === n ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground",
                )}
              >
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} className="h-3.5 w-[5px] rounded-[1px] bg-current" aria-hidden="true" />
                ))}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex min-w-0 items-center gap-1.5 text-sm">
              {/* On phones only the chosen option shows (long in Russian/Turkmen); the label stays for screen readers */}
              <span className="sr-only text-muted-foreground sm:not-sr-only">{t("sortBy")}</span>
              <span className="font-medium">{t(`sort.${query.sort}`)}</span>
              <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuRadioGroup value={query.sort} onValueChange={(v) => commit({ ...query, sort: v as SortOption })}>
                {sortOptions.map((k) => (
                  <DropdownMenuRadioItem key={k} value={k}>
                    {t(`sort.${k}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {toolbarEnd}
        </div>
      </div>

      {/* Active filters */}
      {chips.length > 0 && (
        <ul className="mb-8 flex flex-wrap items-center gap-2" aria-label={t("activeFilters")}>
          {chips.map((c) => (
            <li key={c.label}>
              <button
                type="button"
                onClick={c.clear}
                aria-label={t("removeFilter", { label: c.label })}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-primary-soft"
              >
                {c.label} <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => commit(clearFilters(query))} className="px-2 text-xs underline underline-offset-4">
              {t("clearAll")}
            </button>
          </li>
        </ul>
      )}

      {/* 5. Grid */}
      {products.length === 0 && emptyState ? (
        emptyState
      ) : visible.length === 0 ? (
        <div className="mx-auto max-w-md py-20 text-center">
          <h2 className="text-3xl">{t("emptyTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("emptyBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {activeCount > 0 && <Button onClick={() => commit(clearFilters(query))}>{t("clearFilters")}</Button>}
            <Button asChild variant="outline">
              <Link href={allHref}>{t("shopAll")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ProductGrid products={visible} columns={query.view} priorityCount={query.view} />
      )}

      {/* 6. Show more */}
      {results.length > 0 && (
        <div className="mx-auto mt-16 flex max-w-xs flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("showing", { shown: visible.length, total: results.length })}
          </p>
          <div className="h-px w-full bg-border" aria-hidden="true">
            <div
              className="h-px bg-foreground transition-[width] duration-500 ease-calm"
              style={{ width: `${(visible.length / results.length) * 100}%` }}
            />
          </div>
          {visible.length < results.length && (
            <Button variant="outline" size="lg" className="w-full" onClick={() => commit({ ...query, show: query.show + PAGE_SIZE })}>
              {t("showMore")}
            </Button>
          )}
        </div>
      )}

      <FilterDrawer open={drawerOpen} onOpenChange={setDrawerOpen} products={products} query={query} onApply={commit} />
    </div>
  );
}

