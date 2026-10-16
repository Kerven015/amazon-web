import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/motion-ui/accordion";
import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { familySwatches } from "@/lib/product-utils";
import { cn } from "@/lib/utils";
import type { ColorFamily, Product } from "@/types";
import { PriceRangeSlider } from "./price-range-slider";
import {
  type CollectionQuery,
  type MultiKey,
  applyQuery,
  clearFilters,
  facet,
} from "./query-state";
import { useFilterLabels } from "./filter-labels";
import { useT } from "@/i18n";

const GROUP_ORDER: MultiKey[] = ["type", "feel", "gsm", "material", "colour", "size", "design", "brand"];

type SizeKind = "towel" | "robe" | "sets";
const sizeKind = (name: string): SizeKind => (/^(XS|S|M|L|XL|XXL)$/.test(name) ? "robe" : /-piece$/.test(name) ? "sets" : "towel");

/** Splits size options into towel sizes, robe sizes and sets; one kind → no headings. */
function groupSizes<T extends { value: string }>(options: T[]): { kind: SizeKind | null; options: T[] }[] {
  const order: SizeKind[] = ["towel", "robe", "sets"];
  const groups = order.map((kind) => ({ kind, options: options.filter((o) => sizeKind(o.value) === kind) })).filter((g) => g.options.length);
  return groups.length > 1 ? groups : [{ kind: null, options }];
}

function GroupTrigger({ label, count }: { label: string; count: number }) {
  return (
    <AccordionTrigger className="py-4 text-sm font-medium">
      <span>
        {label}
        {count > 0 && <span className="ml-2 text-xs text-muted-foreground">({count})</span>}
      </span>
      <span aria-hidden="true" className="text-lg font-light leading-none transition-transform duration-300 group-data-[state=open]:rotate-45">
        +
      </span>
    </AccordionTrigger>
  );
}

/**
 * Off-canvas filter panel. Edits a draft copy of the query; the footer shows
 * the live result count and "Apply" commits to the URL.
 */
export function FilterDrawer({
  open,
  onOpenChange,
  products,
  query,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: Product[];
  query: CollectionQuery;
  onApply: (q: CollectionQuery) => void;
}) {
  const [draft, setDraft] = useState(query);
  const t = useT("filters");
  const labels = useFilterLabels(products);
  useEffect(() => {
    if (open) setDraft(query);
  }, [open, query]);

  const count = useMemo(() => applyQuery(products, draft).length, [products, draft]);
  const bounds = useMemo<[number, number]>(() => {
    if (!products.length) return [0, 100];
    const prices = products.map((p) => p.price);
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [products]);

  const groups = GROUP_ORDER.map((key) => ({ key, options: facet(products, draft, key) })).filter(
    (g) => g.options.length > 1 || (g.options.length === 1 && draft[g.key].length > 0) || (g.key === "colour" && g.options.length > 0),
  );

  /** Closing with X, Esc or the backdrop keeps the shopper's changes (same as Apply). */
  const changed = (["type", "feel", "gsm", "material", "colour", "size", "design", "brand"] as const).some((k) => draft[k].join() !== query[k].join()) ||
    draft.min !== query.min || draft.max !== query.max || draft.fast !== query.fast || draft.stock !== query.stock || draft.sale !== query.sale;
  const setOpen = (o: boolean) => {
    if (!o && changed) onApply({ ...draft, show: query.show });
    onOpenChange(o);
  };

  const toggle = (key: MultiKey, value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        title={t("title")}
        bodyClassName="px-5 sm:px-6"
        footer={
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              {t("showingPrefix")} <AnimatedNumber value={count} className="font-medium text-foreground" /> {t("itemsSuffix", { count })}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDraft(clearFilters(draft))}
                className="shrink-0 text-sm underline decoration-1 underline-offset-4"
              >
                {t("clearAll")}
              </button>
              <Button
                className="flex-1"
                size="lg"
                onClick={() => setOpen(false)}
              >
                {t("apply")}
              </Button>
            </div>
          </div>
        }
      >
        <Accordion defaultValue={["type", "feel", "colour", "price"]} className="divide-y">
          {groups.map(({ key, options }) => (
            <AccordionItem key={key} value={key} className="py-0">
              <GroupTrigger label={labels.group(key)} count={draft[key].length} />
              <AccordionContent className="pb-5">
                {key === "colour" ? (
                  <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
                    {options.map((o) => {
                      const on = draft.colour.includes(o.value);
                      return (
                        <li key={o.value}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle("colour", o.value)}
                            disabled={o.count === 0 && !on}
                            className="flex w-full flex-col items-center gap-1.5 text-xs disabled:opacity-40"
                          >
                            <span
                              className={cn(
                                "grid size-9 place-items-center rounded-full border border-black/10 ring-offset-2 ring-offset-surface transition-shadow",
                                on && "ring-1 ring-foreground",
                              )}
                              style={{ background: familySwatches[o.value as ColorFamily] }}
                            >
                              {on && <Check className={cn("size-4", o.value === "White" || o.value === "Neutral" ? "text-foreground" : "text-white")} aria-hidden="true" />}
                            </span>
                            <span>
                              {labels.value("colour", o.value)} <span className="text-muted-foreground">({o.count})</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  // Sizes are grouped (towel sizes / robe sizes / sets) when more than one kind is listed
                  (key === "size" ? groupSizes(options) : [{ kind: null, options }]).map((g) => (
                    <div key={g.kind ?? "all"} className="[&+&]:mt-5">
                      {g.kind && <p className="eyebrow mb-2.5 text-muted-foreground">{t(`sizeGroups.${g.kind}`)}</p>}
                      <ul className="space-y-1">
                        {g.options.map((o) => (
                          <li key={o.value}>
                            <label className={cn("flex min-h-9 cursor-pointer items-center gap-3 text-sm", o.count === 0 && "opacity-50")}>
                              <Checkbox checked={draft[key].includes(o.value)} onChange={() => toggle(key, o.value)} />
                              <span>
                                {labels.value(key, o.value)} <span className="text-muted-foreground">({o.count})</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </AccordionContent>
            </AccordionItem>
          ))}

          <AccordionItem value="price" className="py-0">
            <GroupTrigger label={labels.group("price")} count={draft.min !== undefined || draft.max !== undefined ? 1 : 0} />
            <AccordionContent className="pb-6 pt-1">
              <PriceRangeSlider
                bounds={bounds}
                value={[draft.min, draft.max]}
                onChange={([min, max]) => setDraft((d) => ({ ...d, min, max }))}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="availability" className="py-0">
            <GroupTrigger label={labels.group("availability")} count={[draft.fast, draft.stock, draft.sale].filter(Boolean).length} />
            <AccordionContent className="space-y-3 pb-5">
              {(
                [
                  ["fast", t("fast")],
                  ["stock", t("inStockOnly")],
                  ["sale", t("onSale")],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
