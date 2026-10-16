import { BadgeCheck, ThumbsUp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { InView } from "@/components/motion-ui/in-view";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { Product } from "@/types";
import { RatingStars } from "./rating-stars";
import { formatNumber, useLocale, useT } from "@/i18n";
import { colourLabel, sizeLabel } from "@/lib/localize";
import { useMyReviews } from "@/lib/store/my-reviews";
import { ReviewDialog } from "./review-dialog";

const PAGE = 4;

const averageRating = (list: { rating: number }[]) => Math.round((list.reduce((n, r) => n + r.rating, 0) / list.length) * 10) / 10;

/**
 * Reviews: average + star distribution (click a bar to filter) on the left,
 * the list with "Show more reviews" on the right. Uses product.reviews.
 */
export function ProductReviews({ product }: { product: Product }) {
  const t = useT("reviews");
  const locale = useLocale();
  const mine = useMyReviews((s) => s.reviews);
  const own = useMemo(() => mine.filter((r) => r.productId === product.id), [mine, product.id]);
  // One list drives everything: the average, "Based on X", the bars and the list
  const reviews = useMemo(() => [...own, ...(product.reviews ?? [])], [own, product.reviews]);
  const average = reviews.length ? averageRating(reviews) : product.rating;
  const [writing, setWriting] = useState(false);
  const [filter, setFilter] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [helpful, setHelpful] = useState<string[]>([]);

  const counts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => (c[Math.round(r.rating)] += 1));
    return c;
  }, [reviews]);
  const list = filter ? reviews.filter((r) => Math.round(r.rating) === filter) : reviews;
  const visible = list.slice(0, shown);

  const choose = (star: number | null) => {
    setFilter((f) => (f === star ? null : star));
    setShown(PAGE);
  };

  return (
    <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-28 border-t pt-16">
      <InView className="grid gap-12 md:grid-cols-[300px_1fr] lg:gap-20">
        <div>
          <h2 id="reviews-h" className="text-4xl">{t("title")}</h2>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-serif text-6xl">{formatNumber(average, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
            <span className="text-sm text-muted-foreground">{t("outOf5")}</span>
          </div>
          <RatingStars rating={average} size="md" />
          <p className="mt-1 text-xs text-muted-foreground" data-testid="based-on">{t("basedOn", { count: reviews.length })}</p>

          <p className="mt-6 text-xs text-muted-foreground" id="dist-label">{t("filterByRating")}</p>
          <ul className="mt-2 space-y-1" aria-labelledby="dist-label">
            {[5, 4, 3, 2, 1].map((star) => {
              const pct = reviews.length ? Math.round((counts[star] / reviews.length) * 100) : 0;
              const active = filter === star;
              return (
                <li key={star}>
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={!counts[star]}
                    onClick={() => choose(star)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xs px-1 py-1 text-xs transition-colors disabled:opacity-40",
                      active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="w-8 text-left">{star}★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                      <motion.span
                        className="block h-full rounded-full bg-navy"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right text-muted-foreground">
                      {pct}% <span className="sr-only">({t("count", { count: counts[star] })})</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button variant="outline" className="mt-7 w-full" onClick={() => setWriting(true)}>
            {t("write")}
          </Button>
          <ReviewDialog product={product} open={writing} onOpenChange={setWriting} />
        </div>

        <div>
          <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground" aria-live="polite" data-testid="reviews-showing">
              {filter ? t("starFiltered", { count: list.length, stars: filter }) : t("showing", { shown: visible.length, total: list.length })}
            </p>
            {filter && (
              <button type="button" onClick={() => choose(null)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:border-navy">
                {t("starOnly", { stars: filter })} <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="divide-y border-y">
            <AnimatePresence initial={false}>
              {visible.map((r) => (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="py-7"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <RatingStars rating={r.rating} />
                    <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>
                  </div>
                  {own.includes(r) && <p className="mt-2 text-xs font-medium text-navy">{t("yours")}</p>}
                  {/* Mock reviews are written in English; mark them so screen readers use the right voice */}
                  <h3 className="mt-3 text-base font-medium" lang={own.includes(r) ? undefined : "en"}>
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85" lang={own.includes(r) ? undefined : "en"}>
                    {r.body}
                  </p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="text-foreground">{r.author}</span>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> {t("verified")}
                      </span>
                    )}
                    {(r.sizeBought || r.colourBought) && (
                      <span>
                        {t("bought", { items: [sizeLabel(product, r.sizeBought), colourLabel(product, r.colourBought)].filter(Boolean).join(", ") })}
                      </span>
                    )}
                    {!r.sizeBought && !r.colourBought && r.variant && <span>{r.variant}</span>}
                  </p>
                  <button
                    type="button"
                    aria-pressed={helpful.includes(r.id)}
                    onClick={() => setHelpful((h) => (h.includes(r.id) ? h.filter((x) => x !== r.id) : [...h, r.id]))}
                    className={cn(
                      "mt-4 inline-flex items-center gap-1.5 text-xs transition-colors",
                      helpful.includes(r.id) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ThumbsUp className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> {t("helpful", { count: r.helpful + (helpful.includes(r.id) ? 1 : 0) })}
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
            {!visible.length && <li className="py-10 text-center text-sm text-muted-foreground">{t("none")}</li>}
          </ul>
          {locale !== "en" && reviews.length > own.length && <p className="mt-4 text-xs text-muted-foreground">{t("originalLanguage")}</p>}
          {shown < list.length && (
            <Button variant="outline" className="mt-6" onClick={() => setShown((n) => n + PAGE)}>
              {t("showMore")}
            </Button>
          )}
        </div>
      </InView>
    </section>
  );
}
