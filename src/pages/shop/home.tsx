import { Leaf, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useLoaderData } from "react-router";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { InView } from "@/components/motion-ui/in-view";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductRow } from "@/components/product/product-row";
import { RecentlyViewedRow } from "@/components/product/recently-viewed";
import { QuizBanner } from "@/components/quiz/quiz-banner";
import { formatPriceShort, useLocale, useT } from "@/i18n";
import { getBestSellers, getDeals, getNewIn } from "@/lib/api";
import { siteConfig } from "@/lib/config";
import { EditorialImage } from "@/components/ui/editorial-image";
import { iconFor } from "@/lib/navigation";
import { NavIcon } from "@/components/ui/nav-icon";
import { Link } from "@/lib/router";

const promises = [
  { icon: Truck, key: "delivery" },
  { icon: RotateCcw, key: "returns" },
  { icon: Leaf, key: "materials" },
  { icon: ShieldCheck, key: "makers" },
] as const;

/** Towel collections shown as tiles (titles come from collections.{slug}.title). */
const tiles = ["bath-towels", "beach-towels", "baby-towels", "kitchen-towels", "bath-mats-rugs", "bath-robes"];

export async function homeLoader() {
  const [bestSellers, newIn, deals] = await Promise.all([getBestSellers(8), getNewIn(10), getDeals()]);
  return { bestSellers, newIn, deals };
}

export default function HomePage() {
  const { bestSellers, newIn, deals } = useLoaderData<typeof homeLoader>();
  const t = useT("home");
  const tc = useT("collections");
  const locale = useLocale();

  return (
    <>
      <PageTitle />
      <HeroCarousel />

      <ul className="border-b" aria-label={t("promisesLabel")}>
        <Container className="grid grid-cols-2 gap-y-5 py-6 lg:grid-cols-4">
          {promises.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center justify-center gap-3 text-center sm:text-left">
              <Icon className="size-5 shrink-0" strokeWidth={1.25} aria-hidden="true" />
              <span className="text-sm">
                <span className="font-medium">{t(`promises.${key}.title`)}</span>
                <span className="hidden text-muted-foreground sm:inline">
                  {" · "}
                  {t(`promises.${key}.body`, { amount: formatPriceShort(siteConfig.freeShippingThreshold, locale) })}
                </span>
              </span>
            </li>
          ))}
        </Container>
      </ul>

      {/* No bottom padding: the footer's own top margin (96px) is the gap after the last section */}
      <Container className="space-y-24 pt-20">
        <section aria-labelledby="cats-heading">
          <InView className="mb-10 text-center">
            <p className="eyebrow mb-2 text-muted-foreground">{t("collectionsEyebrow")}</p>
            <h2 id="cats-heading" className="text-4xl sm:text-5xl">
              {t("collectionsTitle")}
            </h2>
          </InView>
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {tiles.map((slug, i) => (
              <li key={slug}>
                <Link href={`/collections/${slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-sm bg-muted sm:aspect-[4/3]">
                  <EditorialImage
                    seed={`vd-col-${slug}`}
                    width={900}
                    height={720}
                    alt=""
                    fill
                    priority={i < 2}
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <span className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" aria-hidden="true" />
                  <span className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4 text-white sm:p-5">
                    <span className="flex min-w-0 items-center gap-2 font-serif text-xl leading-tight [overflow-wrap:anywhere] [hyphens:auto] sm:gap-2.5 sm:text-3xl">
                      {iconFor(slug) && (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream/95" aria-hidden="true">
                          <NavIcon name={iconFor(slug)!} size={16} />
                        </span>
                      )}
                      {tc(`${slug}.title`)}
                    </span>
                    <span className="text-xs font-medium underline decoration-1 underline-offset-4">{t("shopNow")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="best-heading">
          <InView className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2 text-muted-foreground">{t("bestEyebrow")}</p>
              <h2 id="best-heading" className="text-4xl sm:text-5xl">
                {t("bestTitle")}
              </h2>
            </div>
            <Link href="/search?sort=bestselling" className="text-sm font-medium underline decoration-1 underline-offset-4">
              {t("viewAll")}
            </Link>
          </InView>
          <ProductGrid products={bestSellers} priorityCount={0} />
        </section>

        <QuizBanner />

        <ProductRow eyebrow={t("newEyebrow")} title={t("newTitle")} products={newIn} href="/search?sort=newest" />
        <ProductRow eyebrow={t("dealsEyebrow")} title={t("dealsTitle")} products={deals} href="/search?deals=1" />
        <RecentlyViewedRow />
      </Container>

    </>
  );
}
