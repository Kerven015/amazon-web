import { Minus, Plus, Trash2 } from "lucide-react";
import { SlidingNumber } from "@/components/motion-ui/sliding-number";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  onRemove,
  label,
  size = "md",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** When provided, the minus button becomes a remove button at the minimum. */
  onRemove?: () => void;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useT("quantity");
  label ??= t("label");
  const h = size === "sm" ? "h-9" : "h-12";
  const btn = cn(
    "grid aspect-square place-items-center text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
    h,
  );
  const atMin = value <= min;

  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-sm border border-input bg-surface", className)}>
      {onRemove && atMin ? (
        <button type="button" aria-label={t("remove")} onClick={onRemove} className={cn(btn, "rounded-l-sm text-danger")}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("decrease")}
          disabled={atMin}
          onClick={() => onChange(value - 1)}
          className={cn(btn, "rounded-l-sm")}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
      )}
      <output aria-live="polite" aria-label={`${label}: ${value}`} className="min-w-9 text-center text-sm font-semibold">
        <SlidingNumber value={value} />
      </output>
      <button
        type="button"
        aria-label={t("increase")}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={cn(btn, "rounded-r-sm")}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
