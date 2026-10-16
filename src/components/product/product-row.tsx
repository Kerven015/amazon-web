import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "@/lib/router";
import { useEffect, useRef, useState } from "react";
import { InView } from "@/components/motion-ui/in-view";
import type { Product } from "@/types";
import { ProductCard } from "./product-card";
import { useT } from "@/i18n";

/** Horizontal, scroll-snapping row of product cards with quiet arrow controls. */
export function ProductRow({
  title,
  eyebrow,
  products,
  href,
  id,
}: {
  title: string;
  eyebrow?: string;
  products: Product[];
  href?: string;
  id?: string;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const t = useT("common");
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [products.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (!products.length) return null;
  const headingId = id ?? `row-${title.toLowerCase().replace(/\W+/g, "-")}`;
  const arrow =
    "grid size-10 place-items-center rounded-full border transition-colors duration-200 hover:border-foreground disabled:opacity-30 disabled:hover:border-border";

  return (
    <section aria-labelledby={headingId}>
      <InView>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-2 text-muted-foreground">{eyebrow}</p>}
            <h2 id={headingId} className="text-balance text-3xl [overflow-wrap:anywhere] sm:text-4xl">
              {title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {href && (
              <Link href={href} className="inline-flex min-h-10 items-center whitespace-nowrap text-sm sm:mr-2 font-medium underline decoration-1 underline-offset-4">
                {t("viewAll")}
              </Link>
            )}
            <button type="button" aria-label={t("scrollBack", { title })} onClick={() => scrollBy(-1)} disabled={!canPrev} className={`${arrow} hidden sm:grid`}>
              <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("scrollForward", { title })} onClick={() => scrollBy(1)} disabled={!canNext} className={`${arrow} hidden sm:grid`}>
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <ul
          ref={scroller}
          onScroll={update}
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:gap-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
        >
          {products.map((p) => (
            <li key={p.id} className="w-[64%] shrink-0 snap-start sm:w-[38%] md:w-[30%] lg:w-[23%]">
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </InView>
    </section>
  );
}
