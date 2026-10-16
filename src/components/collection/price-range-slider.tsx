import { useEffect, useId, useState } from "react";
import { formatPriceShort, useLocale, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Dual-handle price slider (two stacked native ranges) with min/max inputs. */
export function PriceRangeSlider({
  bounds,
  value,
  onChange,
}: {
  bounds: [number, number];
  value: [number | undefined, number | undefined];
  onChange: (v: [number | undefined, number | undefined]) => void;
}) {
  const id = useId();
  const t = useT("filters.price");
  // Where formatPrice puts the symbol: "$24" in English, "24 $" in tr/tk/ru
  const symbolFirst = formatPriceShort(1, useLocale()).startsWith("$");
  const [lo, hi] = bounds;
  const min = value[0] ?? lo;
  const max = value[1] ?? hi;
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));

  useEffect(() => setMinText(String(min)), [min]);
  useEffect(() => setMaxText(String(max)), [max]);

  const emit = (a: number, b: number) => onChange([a <= lo ? undefined : a, b >= hi ? undefined : b]);
  const span = Math.max(1, hi - lo);
  const left = ((min - lo) / span) * 100;
  const right = 100 - ((max - lo) / span) * 100;

  const commitText = () => {
    let a = Number(minText);
    let b = Number(maxText);
    if (!Number.isFinite(a)) a = lo;
    if (!Number.isFinite(b)) b = hi;
    a = Math.max(lo, Math.min(a, hi));
    b = Math.max(lo, Math.min(b, hi));
    if (a > b) [a, b] = [b, a];
    emit(a, b);
  };

  return (
    <div className="space-y-4">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" />
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground" style={{ left: `${left}%`, right: `${right}%` }} />
        <input
          type="range"
          aria-label={t("min")}
          min={lo}
          max={hi}
          step={1}
          value={min}
          onChange={(e) => emit(Math.min(Number(e.target.value), max), max)}
          className="range-dual absolute inset-0 h-6 w-full"
        />
        <input
          type="range"
          aria-label={t("max")}
          min={lo}
          max={hi}
          step={1}
          value={max}
          onChange={(e) => emit(min, Math.max(Number(e.target.value), min))}
          className="range-dual absolute inset-0 h-6 w-full"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <label htmlFor={`${id}-min`} className="sr-only">{t("minDollars")}</label>
          <span className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-muted-foreground", symbolFirst ? "left-3" : "right-3")}>$</span>
          <Input
            id={`${id}-min`}
            inputMode="numeric"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => e.key === "Enter" && commitText()}
            className={cn("h-10", symbolFirst ? "pl-6" : "pr-7 text-right")}
          />
        </div>
        <span aria-hidden="true" className="text-muted-foreground">{t("to")}</span>
        <div className="relative flex-1">
          <label htmlFor={`${id}-max`} className="sr-only">{t("maxDollars")}</label>
          <span className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-muted-foreground", symbolFirst ? "left-3" : "right-3")}>$</span>
          <Input
            id={`${id}-max`}
            inputMode="numeric"
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => e.key === "Enter" && commitText()}
            className={cn("h-10", symbolFirst ? "pl-6" : "pr-7 text-right")}
          />
        </div>
      </div>
    </div>
  );
}
