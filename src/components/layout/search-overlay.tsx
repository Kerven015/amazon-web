import { hasPriceRange, productHref } from "@/lib/product-utils";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Search, X } from "lucide-react";
import { Link } from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useEffect, useId, useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { getRecommended, getSearchSuggestions } from "@/lib/api";
import { usePanels } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import { PriceTag } from "@/components/product/price-tag";
import type { Product } from "@/types";
import { ProductImage } from "@/components/product/product-image";
import { useT } from "@/i18n";

/** Popular searches: messages → search.popular (translated search terms) */
const POPULAR_KEYS = ["bathTowel", "waffle", "beach", "baby", "robe", "bundle", "bathMat", "turkishCotton"] as const;

/** Full-width search panel: popular searches + suggestions before typing, live results while typing. */
export function SearchOverlay() {
  const open = usePanels((s) => s.open === "search");
  const close = usePanels((s) => s.close);
  const router = useRouter();
  const id = useId();
  const t = useT("search");
  const popular = POPULAR_KEYS.map((k) => t(`popular.${k}`));

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (open && !recommended.length) getRecommended(4).then(setRecommended);
  }, [open, recommended.length]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await getSearchSuggestions(query, 6);
      if (!cancelled) {
        setResults(r);
        setActive(-1);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (href: string) => {
    close();
    router.push(href);
  };
  const submit = (term = query) => {
    if (!term.trim()) return;
    go(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  const typing = query.trim().length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!typing || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(productHref(results[active]));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          close();
          setQuery("");
        }
      }}
    >
      <SheetContent side="top" title={t("title")} hideHeader className="border-b" bodyClassName="overflow-y-auto">
        <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-5 sm:px-8 sm:pt-8">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-3 border-b border-foreground/70 pb-3"
          >
            <Search className="size-6 shrink-0" strokeWidth={1.25} aria-hidden="true" />
            <input
              autoFocus
              type="search"
              role="combobox"
              aria-label={t("inputLabel")}
              aria-expanded={typing}
              aria-controls={`${id}-results`}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
              placeholder={t("placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 bg-transparent font-serif text-2xl text-foreground outline-none placeholder:text-muted-foreground sm:text-4xl [&::-webkit-search-cancel-button]:hidden"
            />
            {typing && (
              <button type="button" onClick={() => setQuery("")} className="text-xs font-medium underline underline-offset-4">
                {t("clear")}
              </button>
            )}
            <SheetClose aria-label={t("close")} className="grid size-10 place-items-center rounded-full hover:bg-muted">
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </SheetClose>
          </form>

          <AnimatePresence mode="wait" initial={false}>
            {!typing ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-7 grid gap-8 lg:grid-cols-[260px_1fr]"
              >
                <div>
                  <p className="eyebrow mb-3 text-muted-foreground">{t("popularTitle")}</p>
                  <ul className="flex flex-wrap gap-2">
                    {popular.map((term) => (
                      <li key={term}>
                        <button
                          type="button"
                          onClick={() => submit(term)}
                          className="rounded-full border px-4 py-2 text-sm transition-colors duration-200 hover:border-foreground"
                        >
                          {term}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow mb-3 text-muted-foreground">{t("youMayLike")}</p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
                    {recommended.map((p) => (
                      <li key={p.id} onClickCapture={(e) => (e.target as HTMLElement).closest("a") && close()}>
                        <ProductCard product={p} size="compact" />
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-6"
              >
                <p className="eyebrow mb-2 text-muted-foreground" aria-live="polite">
                  {results.length ? t("productsCount", { count: results.length }) : t("noMatches")}
                </p>
                <ul id={`${id}-results`} role="listbox" aria-label={t("suggestions")} className="grid gap-x-8 sm:grid-cols-2">
                  {results.map((p, i) => (
                    <li
                      key={p.id}
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={active === i}
                      className={cn("border-b", active === i && "bg-muted")}
                    >
                      <Link href={productHref(p)} onClick={close} className="flex items-center gap-4 py-3">
                        <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xs bg-cream">
                          <ProductImage src={p.images[0]?.src ?? ""} alt={p.images[0]?.alt ?? p.title} blurDataURL={p.images[0]?.blurDataURL} sizes="64px" decorative iconClassName="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-muted-foreground">{p.tagline}</span>
                          <span className="block truncate text-sm font-medium">{p.title}</span>
                        </span>
                        <PriceTag price={p.price} listPrice={p.listPrice} from={hasPriceRange(p)} size="sm" className="shrink-0 justify-end text-right" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={() => submit()}
                    className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium underline decoration-1 underline-offset-4"
                  >
                    {t("seeAll", { query: query.trim() })} <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
