import { Star } from "lucide-react";
import { cn, formatCompact } from "@/lib/utils";
import { formatNumber, useT } from "@/i18n";

export function RatingStars({
  rating,
  count,
  size = "sm",
  className,
  showValue = false,
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showValue?: boolean;
}) {
  const px = size === "lg" ? "size-5" : size === "md" ? "size-4" : "size-3.5";
  const t = useT("reviews");
  const value = formatNumber(rating, undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showValue && <span className="text-sm font-semibold">{value}</span>}
      <span className="relative inline-flex" role="img" aria-label={t("rated", { value })}>
        <span className="flex text-border" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn(px, "fill-current")} />
          ))}
        </span>
        <span
          className="absolute inset-y-0 left-0 flex overflow-hidden text-star"
          style={{ width: `${(rating / 5) * 100}%` }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn(px, "shrink-0 fill-current")} />
          ))}
        </span>
      </span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">
          ({formatCompact(count)}
          <span className="sr-only"> {t("reviewsWord", { count })}</span>)
        </span>
      )}
    </span>
  );
}
