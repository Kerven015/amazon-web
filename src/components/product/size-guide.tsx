import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { dimensionLabel, sizePrice } from "@/lib/product-utils";
import { cn, formatPrice } from "@/lib/utils";
import type { Product } from "@/types";
import { useT } from "@/i18n";

/** "Size guide" link → right-hand drawer with dimensions in cm and inches. */
export function SizeGuide({ product }: { product: Product }) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const t = useT("sizeGuide");
  const sizes = product.sizes ?? [];
  const hasDims = sizes.some((s) => s.widthCm || s.lengthCm);

  return (
    <Sheet>
      <SheetTrigger className="text-xs underline underline-offset-4 hover:text-foreground">{t("title")}</SheetTrigger>
      <SheetContent side="right" title={t("title")} description={t("description", { title: product.title })} bodyClassName="px-5 py-6 sm:px-6">
        <p className="text-sm text-muted-foreground">{product.title}</p>
        {hasDims && (
          <div className="mt-5 inline-flex rounded-full border p-1 text-xs" role="radiogroup" aria-label={t("units.label")}>
            {(["cm", "in"] as const).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => setUnit(u)}
                className={cn("rounded-full px-4 py-1.5 transition-colors", unit === u ? "bg-navy text-cream" : "hover:bg-muted")}
              >
                {u === "cm" ? t("units.centimetres") : t("units.inches")}
              </button>
            ))}
          </div>
        )}
        <table className="mt-5 w-full text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">{t("size")}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{hasDims ? t("dimensions", { unit: t(`units.${unit}`) }) : t("details")}</th>
              <th scope="col" className="py-2 text-right font-medium">{t("price")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sizes.map((s) => (
              <tr key={s.name}>
                <th scope="row" className="py-3 pr-3 text-left font-medium">{s.label ?? s.name}</th>
                <td className="py-3 pr-3">
                  {s.widthCm || s.lengthCm ? dimensionLabel(s, unit) : (s.note ?? "—")}
                  {(s.widthCm || s.lengthCm) && s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}
                </td>
                <td className="price py-3 text-right">{formatPrice(sizePrice(s).price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          {t("note")}
        </p>
      </SheetContent>
    </Sheet>
  );
}
