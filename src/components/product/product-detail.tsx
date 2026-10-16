import { Truck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/motion-ui/accordion";
import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { LOW_STOCK, colorGallery, dimensionLabel, priceFor, sizePrice, stockFor } from "@/lib/product-utils";
import { Link } from "@/lib/router";
import { cn, discountPercent, formatPrice, formatPriceShort } from "@/lib/utils";
import { upper, useLocale, useT } from "@/i18n";
import { deliveryDays, deliveryName, deliveryPrice, deliveryWindow } from "@/lib/delivery";
import type { Product } from "@/types";
import { CareIcon, FeatureIcon } from "./care-icon";
import { NotifyMe } from "./notify-me";
import { ProductGallery } from "./product-gallery";
import { ProductImage } from "./product-image";
import { QuantityStepper } from "./quantity-stepper";
import { RatingStars } from "./rating-stars";
import { SizeGuide } from "./size-guide";
import { useAddToCart, variantLabel as labelOf } from "./use-add-to-cart";
import { colourLabel, sizeLabel } from "@/lib/localize";
import { formatNumber } from "@/i18n";
import { WishlistButton } from "./wishlist-button";

/* ----------------------------- helpers ----------------------------- */

function Row({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="py-0">
      <AccordionTrigger className="py-4 text-sm font-medium">
        {title}
        <span aria-hidden="true" className="text-lg font-light leading-none transition-transform duration-300 group-data-[state=open]:rotate-45">
          +
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">{children}</AccordionContent>
    </AccordionItem>
  );
}

/* ----------------------------- component ----------------------------- */

/** Gallery (left, ~58%) + sticky product information (right, ~42%). */
export function ProductDetail({ product, initialColor }: { product: Product; initialColor?: string }) {
  const colors = product.variants.colors ?? [];
  const sizes = product.sizes ?? [];
  const multiSize = sizes.length > 1;

  const [color, setColor] = useState<string | undefined>(
    colors.find((c) => c.name === initialColor)?.name ?? colors.find((c) => stockFor(product, c.name) > 0)?.name ?? colors[0]?.name,
  );
  const [size, setSize] = useState<string | undefined>(multiSize ? undefined : sizes[0]?.name);
  const [qty, setQty] = useState(1);
  const addToCart = useAddToCart();
  const t = useT("productPage");
  const tb = useT("badges");
  const locale = useLocale();

  const images = useMemo(() => colorGallery(product, color), [product, color]);
  const { price, listPrice } = priceFor(product, { size });
  const fromPrice = multiSize && !size && new Set(sizes.map((s) => sizePrice(s).price)).size > 1;
  const pct = discountPercent(price, listPrice);

  const stock = stockFor(product, color, size);
  const soldOut = stock <= 0;
  const lowStock = !soldOut && (product.stockStatus === "low" || (product.stockStatus !== "in" && stock <= LOW_STOCK));
  const maxQty = Math.max(1, Math.min(10, stock));
  useEffect(() => setQty((q) => Math.min(q, maxQty)), [maxQty]);

  const needsSize = multiSize && !size;
  const variantLabel = labelOf({ color, size }, product) || product.title;

  // Adds straight away; the bag drawer opening is the confirmation (no extra toast)
  const add = () => {
    if (needsSize || soldOut) return;
    addToCart(product, { color, size }, qty);
  };

  // Sticky mobile bar once the main button has scrolled out of view
  const ctaRef = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToReviews = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const badge =
    product.stock <= 0 || product.stockStatus === "out" ? (
      <Badge variant="neutral">{upper(tb("soldOut"), locale)}</Badge>
    ) : pct > 0 ? (
      <Badge variant="deal">−{pct}%</Badge>
    ) : product.badge ? (
      <Badge variant="surface">{upper(tb(product.badge), locale)}</Badge>
    ) : null;

  const arrives = deliveryWindow("standard");
  const fastArrives = deliveryWindow("fast");
  const freeOver = siteConfig.freeShippingThreshold;
  const hasDims = sizes.some((s) => s.widthCm || s.lengthCm || s.note);

  const cta = (compact = false) =>
    soldOut && !needsSize ? (
      compact ? (
        <Button size="sm" variant="outline" onClick={() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          {t("notifyShort")}
        </Button>
      ) : (
        <NotifyMe productId={product.id} label={`${product.title} (${variantLabel})`} />
      )
    ) : (
      <Button
        size={compact ? "default" : "lg"}
        className={cn(!compact && "min-h-12 w-full")}
        disabled={needsSize}
        onClick={add}
      >
        {needsSize ? t("selectASize") : t("addToBag")}
      </Button>
    );

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-12 xl:gap-16">
        <ProductGallery images={images} title={product.title} badge={badge} />

        <div className="lg:sticky lg:top-24 lg:self-start lg:pb-6">
          {/* 1–3: tagline, name, rating */}
          {product.tagline && <p className="text-sm text-muted-foreground">{product.tagline}</p>}
          <h1 className="mt-2 text-balance text-4xl leading-[1.08] [overflow-wrap:anywhere] hyphens-auto sm:text-[44px]">{product.title}</h1>
          <a href="#reviews" onClick={scrollToReviews} className="mt-3 inline-flex items-center gap-2 rounded-xs text-sm hover:underline hover:underline-offset-4">
            <RatingStars rating={product.rating} />
            <span>
              {formatNumber(product.rating, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
              <span className="text-muted-foreground">({t("reviewsCount", { count: product.reviewCount })})</span>
            </span>
          </a>

          {/* 4: price */}
          <div className="price mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {fromPrice && <span className="text-sm text-muted-foreground">{t("from")}</span>}
            <span className={cn("text-[28px] font-medium leading-none", pct > 0 ? "text-accent" : "text-foreground")}>
              {pct > 0 && <span className="sr-only">{t("now")} </span>}
              <AnimatedNumber value={price} format={(v) => formatPrice(v)} />
            </span>
            {pct > 0 && listPrice && (
              <>
                <span className="text-lg text-muted-foreground">
                  <span className="sr-only">{t("was")} </span>
                  <s>{formatPrice(listPrice)}</s>
                </span>
                <Badge variant="deal">−{pct}%</Badge>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("taxIncluded")}</p>

          <div className="mt-7 space-y-6">
            {/* 5: colour */}
            {colors.length > 0 && (
              <div>
                <p className="mb-3 text-sm">
                  {t("colour")}: <span className="font-medium">{colourLabel(product, color)}</span>
                </p>
                <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t("chooseColour")}>
                  {colors.map((c) => {
                    const out = stockFor(product, c.name, size) <= 0;
                    const selected = c.name === color;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={out ? t("optionOutOfStock", { name: c.label ?? c.name }) : (c.label ?? c.name)}
                        title={out ? t("optionOutOfStock", { name: c.label ?? c.name }) : (c.label ?? c.name)}
                        onClick={() => setColor(c.name)}
                        className={cn(
                          "relative grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow duration-200",
                          selected ? "ring-2 ring-navy" : "hover:ring-1 hover:ring-navy/40",
                        )}
                      >
                        <span className={cn("size-full overflow-hidden rounded-full border border-black/10", out && "opacity-60")} style={{ background: c.hex }} />
                        {out && (
                          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                            <span className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-navy/70" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6: size */}
            {multiSize && (
              <fieldset>
                <legend className="mb-3 flex w-full items-center justify-between text-sm">
                  <span>
                    {t("size")}: <span className="font-medium">{size ? sizeLabel(product, size) : t("selectASize")}</span>
                  </span>
                  {hasDims && <SizeGuide product={product} />}
                </legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("chooseSize")}>
                  {sizes.map((s) => {
                    const p = sizePrice(s);
                    const out = stockFor(product, color, s.name) <= 0;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        role="radio"
                        aria-checked={size === s.name}
                        onClick={() => setSize(s.name)}
                        className={cn(
                          "min-h-11 rounded-xs border px-3 py-2 text-left text-sm transition-colors duration-200",
                          size === s.name ? "border-navy bg-navy text-cream" : "border-input hover:border-navy",
                          out && size !== s.name && "text-muted-foreground",
                        )}
                      >
                        <span className={cn(out && "line-through decoration-1")}>{s.label ?? s.name}</span>
                        <span className="price"> – {formatPriceShort(p.price)}</span>
                        {out && <span className="sr-only"> ({t("outOfStockShort")})</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {!multiSize && sizes[0] && hasDims && (
              <p className="flex items-center justify-between text-sm">
                <span>
                  {t("size")}: <span className="font-medium">{dimensionLabel(sizes[0])}</span>
                </span>
                <SizeGuide product={product} />
              </p>
            )}

            {/* 7–10: stock, quantity, add to bag, wishlist */}
            <div ref={ctaRef} className="space-y-3">
              <p
                role="status"
                className={cn("flex items-center gap-2 text-sm", soldOut ? "text-danger" : lowStock ? "text-warning" : "text-success")}
              >
                <span aria-hidden="true" className={cn("size-2 rounded-full", soldOut ? "bg-danger" : lowStock ? "bg-warning" : "bg-success")} />
                {soldOut ? t("outOfStock") : lowStock ? (stock <= LOW_STOCK ? t("onlyLeft", { count: stock }) : t("lowStock")) : t("inStock")}
              </p>
              {!soldOut && (
                <div className="flex items-center gap-3">
                  <span className="text-sm">{t("quantity")}</span>
                  <QuantityStepper value={qty} onChange={setQty} max={maxQty} />
                </div>
              )}
              {cta()}
              <WishlistButton productId={product.id} title={product.title} variant="text" />
            </div>

            {/* 11: delivery */}
            <div className="flex items-start gap-3 border-y py-4 text-sm">
              <Truck className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.4} aria-hidden="true" />
              <p>
                {t("freeDelivery", { amount: formatPriceShort(freeOver) })}
                <span className="block text-muted-foreground">{t("arrives", { dates: arrives })}</span>
              </p>
            </div>

            {/* 12: key features */}
            {product.features.length > 0 && (
              <ul className="space-y-2.5 text-sm">
                {product.features.slice(0, 4).map((f, i) => (
                  <li key={f} className="flex items-center gap-3">
                    <FeatureIcon text={product.featuresEn?.[i] ?? f} />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {/* 13: accordions */}
            <Accordion defaultValue={["description"]} className="divide-y border-y">
              <Row value="description" title={t("description")}>
                <p className="whitespace-pre-line">{product.description}</p>
                {product.highlights.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {product.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
              </Row>
              <Row value="details" title={t("details")}>
                <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
                  {[
                    [t("material"), product.material],
                    [t("weight"), product.weightGsm ? `${product.weightGsm} GSM` : undefined],
                    [t("weave"), product.weave],
                    [t("origin"), product.origin],
                    [t("brand"), product.brand],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-foreground">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                {hasDims && (
                  <table className="mt-4 w-full">
                    <caption className="mb-1 text-left text-foreground">{t("dimensions")}</caption>
                    <tbody className="divide-y">
                      {sizes.map((s) => (
                        <tr key={s.name}>
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal">{s.label ?? s.name}</th>
                          <td className="py-1.5 text-right">
                            {s.widthCm || s.lengthCm ? `${dimensionLabel(s, "cm")} · ${dimensionLabel(s, "in")}` : s.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Row>
              {product.careInstructions.length > 0 && (
                <Row value="care" title={t("careGuide")}>
                  <ul className="space-y-3">
                    {product.careInstructions.map((c) => (
                      <li key={c.kind + c.text} className="flex items-start gap-3">
                        <CareIcon kind={c.kind} text={c.textEn ?? c.text} className="size-7 shrink-0 text-foreground" />
                        <span className="pt-1">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </Row>
              )}
              <Row value="delivery" title={t("deliveryReturns")}>
                <table className="w-full">
                  <tbody className="divide-y">
                    {(["standard", "fast"] as const).map((id) => (
                      <tr key={id}>
                        <th scope="row" className="py-1.5 pr-3 text-left font-normal text-foreground">
                          {t("deliveryOption", { name: deliveryName(id), days: deliveryDays(id) })}
                        </th>
                        <td className="py-1.5 text-right">
                          {id === "standard"
                            ? t("standardPrice", { price: formatPrice(siteConfig.standardShipping), amount: formatPriceShort(freeOver) })
                            : formatPrice(deliveryPrice(id, 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs">{t("orderToday", { standard: arrives, fast: fastArrives, fastName: deliveryName("fast").toLocaleLowerCase(locale) })}</p>
                <p className="mt-3">{t("returnsSummary")}</p>
                <Link href="/help/returns" className="mt-2 inline-block text-foreground underline underline-offset-4">
                  {t("returnsLink")}
                </Link>
              </Row>
            </Accordion>
          </div>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <AnimatePresence>
        {sticky && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden"
          >
            <div className="flex items-center gap-3">
              <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-xs bg-cream">
                <ProductImage src={images[0]?.src ?? ""} alt="" sizes="44px" decorative iconClassName="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{product.title}</p>
                <p className="price text-sm font-medium">
                  {fromPrice && <span className="font-normal text-muted-foreground">{t("from")} </span>}
                  {formatPrice(price)}
                  {color && <span className="font-normal text-muted-foreground"> · {colourLabel(product, color)}</span>}
                </p>
              </div>
              {needsSize ? (
                <Button onClick={() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>{t("selectSizeShort")}</Button>
              ) : (
                cta(true)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
