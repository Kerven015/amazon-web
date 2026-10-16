import { AnimatePresence, motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { priceFor, stockFor } from "@/lib/product-utils";
import { useT } from "@/i18n";
import { colourLabel, sizeLabel } from "@/lib/localize";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn, formatPrice } from "@/lib/utils";
import type { Product } from "@/types";
import { PriceTag } from "./price-tag";
import { ProductImage } from "./product-image";
import { SwatchRow } from "./swatch-row";
import { defaultVariant, useAddToCart } from "./use-add-to-cart";
import { hasPriceRange } from "@/lib/product-utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Does this product need a size/colour choice before it can go in the bag? */
export const needsOptions = (product: Product) => (product.variants.sizes ?? []).length > 1 || (product.variants.colors ?? []).length > 1;

/**
 * The size/colour picker shared by the card popover and the bottom sheet.
 * Out-of-stock sizes are disabled and struck through; sold-out colours are
 * marked and listed last. Picking an in-stock size adds it to the bag.
 */
function OptionsPicker({
  product,
  color,
  onColorChange,
  onAdd,
  large = false,
}: {
  product: Product;
  color?: string;
  onColorChange: (c: string) => void;
  onAdd: (size?: string) => void;
  large?: boolean;
}) {
  const t = useT("productCard");
  const tp = useT("productPage");
  const sizes = product.variants.sizes ?? [];
  const colors = product.variants.colors ?? [];
  const colourOut = stockFor(product, color) <= 0;

  return (
    <>
      {colors.length > 1 && sizes.length > 1 && (
        <SwatchRow
          colors={colors}
          value={color}
          onSelect={onColorChange}
          max={12}
          size={large ? "md" : "sm"}
          isOut={(c) => stockFor(product, c) <= 0}
          className="mb-3"
        />
      )}
      {sizes.length > 1 ? (
        <ul className={cn("grid gap-1.5", large ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2")}>
          {sizes.map((s) => {
            const out = stockFor(product, color, s) <= 0;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={out}
                  onClick={() => onAdd(s)}
                  aria-label={out ? tp("optionOutOfStock", { name: sizeLabel(product, s) }) : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xs border px-2.5 py-1.5 text-xs transition-colors duration-200 enabled:hover:border-foreground disabled:cursor-not-allowed disabled:text-muted-foreground",
                    large ? "min-h-11 text-sm" : "min-h-9",
                  )}
                >
                  <span className={cn("text-left", out && "line-through decoration-1")}>{sizeLabel(product, s)}</span>
                  <span className="price shrink-0 text-muted-foreground">{out ? tp("outOfStockShort") : formatPrice(priceFor(product, { size: s }).price)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          <SwatchRow colors={colors} value={color} onSelect={onColorChange} max={12} size={large ? "md" : "sm"} isOut={(c) => stockFor(product, c) <= 0} />
          <button
            type="button"
            disabled={colourOut}
            onClick={() => onAdd()}
            className={cn(
              "w-full rounded-xs bg-foreground px-2 py-2 text-[12px] font-medium uppercase tracking-[0.12em] text-background disabled:cursor-not-allowed disabled:opacity-50",
              large ? "min-h-11" : "min-h-9",
            )}
          >
            {colourOut ? tp("optionOutOfStock", { name: colourLabel(product, color) }) : t("addColourToBag", { colour: colourLabel(product, color) })}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Bottom sheet with the product's options — used for quick add on phones and
 * touch screens, and by the wishlist drawer for products with options.
 */
export function QuickAddSheet({
  product,
  open,
  onOpenChange,
  color,
  onColorChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  color?: string;
  onColorChange?: (c: string) => void;
}) {
  const t = useT("productCard");
  const addToCart = useAddToCart();
  const [own, setOwn] = useState(color ?? defaultVariant(product).color);
  useEffect(() => {
    if (open) setOwn(color ?? defaultVariant(product).color);
  }, [open, color, product]);
  const current = onColorChange ? color : own;
  const setColour = (c: string) => (onColorChange ? onColorChange(c) : setOwn(c));
  const sizes = product.variants.sizes ?? [];
  const image = product.variants.colors?.find((c) => c.name === current)?.image || product.images[0]?.src || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" title={t("chooseOptions", { title: product.title })} hideHeader bodyClassName="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
        <div className="mx-auto max-w-lg" data-testid="quick-add-sheet">
          <div className="mb-4 flex items-start gap-3">
            <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xs bg-cream">
              <ProductImage src={image} alt="" sizes="64px" decorative iconClassName="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
              <PriceTag price={product.price} listPrice={product.listPrice} size="sm" from={hasPriceRange(product)} />
              <p className="eyebrow mt-1 text-muted-foreground">{sizes.length > 1 ? t("selectSize") : t("selectColour")}</p>
            </div>
            <button type="button" aria-label={t("closeOptions")} onClick={() => onOpenChange(false)} className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted">
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <OptionsPicker
            product={product}
            color={current}
            onColorChange={setColour}
            large
            onAdd={(size) => {
              const d = defaultVariant(product);
              onOpenChange(false);
              addToCart(product, { ...d, color: current ?? d.color, size: size ?? d.size });
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * "Quick add" for product cards. Products with options open a picker: a small
 * panel over the image on desktop (hover devices, md and up), a bottom sheet
 * on phones and touch screens. Others add straight to the bag.
 * `mode="hover"` (desktop) reveals on card hover; `mode="inline"` (touch) is always visible.
 */
export function QuickAdd({
  product,
  color,
  onColorChange,
  mode,
}: {
  product: Product;
  color?: string;
  onColorChange?: (c: string) => void;
  mode: "hover" | "inline";
}) {
  const addToCart = useAddToCart();
  const t = useT("productCard");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const small = useMediaQuery("(max-width: 767px)");
  const useSheet = mode === "inline" || small;
  const needsPicker = needsOptions(product);
  const soldOut = product.stock <= 0 || product.stockStatus === "out";
  const [ownColor, setOwnColor] = useState(color);
  const current = color ?? ownColor;
  const setColour = (c: string) => (onColorChange ? onColorChange(c) : setOwnColor(c));

  useEffect(() => {
    if (!open || useSheet) return;
    panelRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, useSheet]);

  const add = (size?: string) => {
    const d = defaultVariant(product);
    addToCart(product, { ...d, color: current ?? d.color, size: size ?? d.size });
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      disabled={soldOut}
      aria-haspopup={needsPicker ? "dialog" : undefined}
      aria-expanded={needsPicker ? open : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (needsPicker) setOpen(true);
        else add();
      }}
      className={cn(
        "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xs px-2 text-[12px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 disabled:cursor-not-allowed",
        mode === "hover"
          ? "bg-surface/95 text-foreground backdrop-blur-sm hover:bg-foreground hover:text-background"
          : "border border-foreground/70 text-foreground hover:bg-foreground hover:text-background disabled:border-border disabled:text-muted-foreground",
      )}
    >
      {soldOut ? (
        t("soldOut")
      ) : (
        <>
          <Plus className="size-3.5" aria-hidden="true" /> {t("quickAdd")}
        </>
      )}
    </button>
  );

  return (
    <div className={cn("relative z-10", mode === "hover" ? "absolute inset-x-2 bottom-2" : "mt-2")}>
      {mode === "hover" ? (
        <div className="translate-y-3 opacity-0 transition-[opacity,transform] duration-300 ease-calm focus-within:translate-y-0 focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
          {trigger}
        </div>
      ) : (
        trigger
      )}

      {needsPicker && useSheet && <QuickAddSheet product={product} open={open} onOpenChange={setOpen} color={current} onColorChange={setColour} />}

      <AnimatePresence>
        {open && !useSheet && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={t("chooseOptions", { title: product.title })}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 z-20 rounded-xs bg-surface p-3 shadow-pop"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow text-muted-foreground">{(product.variants.sizes ?? []).length > 1 ? t("selectSize") : t("selectColour")}</p>
              <button type="button" aria-label={t("closeOptions")} onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-full hover:bg-muted">
                <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <OptionsPicker product={product} color={current} onColorChange={setColour} onAdd={add} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
