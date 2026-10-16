import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { ColorOption } from "@/types";

/**
 * Small round colour swatches. Hover/focus previews a colour (onPreview),
 * click selects it (onSelect). Shows the first `max` and a "+N more" link.
 */
export function SwatchRow({
  colors,
  value,
  onPreview,
  onSelect,
  max = 5,
  moreHref,
  size = "sm",
  label,
  isOut,
  className,
}: {
  colors: ColorOption[];
  value?: string;
  onPreview?: (name: string | null) => void;
  onSelect?: (name: string) => void;
  max?: number;
  moreHref?: string;
  size?: "sm" | "md";
  label?: string;
  /** Sold-out colours get a diagonal line and move to the end */
  isOut?: (name: string) => boolean;
  className?: string;
}) {
  const t = useT("productCard");
  const tp = useT("productPage");
  const ordered = isOut ? [...colors.filter((c) => !isOut(c.name)), ...colors.filter((c) => isOut(c.name))] : colors;
  const shown = ordered.slice(0, max);
  const extra = colors.length - shown.length;
  const dim = size === "md" ? "size-8" : "size-[18px]";

  return (
    <div
      className={cn("flex flex-wrap items-center", size === "md" ? "gap-2" : "gap-1.5 [@media(pointer:coarse)]:gap-3.5", className)}
      role="radiogroup"
      aria-label={label ?? t("colour")}
    >
      {shown.map((c) => {
        const selected = value === c.name;
        const out = !!isOut?.(c.name);
        const name = out ? tp("optionOutOfStock", { name: c.label ?? c.name }) : (c.label ?? c.name);
        return (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            onMouseEnter={() => onPreview?.(c.name)}
            onMouseLeave={() => onPreview?.(null)}
            onFocus={() => onPreview?.(c.name)}
            onBlur={() => onPreview?.(null)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect?.(c.name);
            }}
            className={cn(
              "relative grid shrink-0 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow duration-200",
              // Small swatches keep their 18px look but get a 32px touch target
              size === "sm" && "after:absolute after:inset-0 after:rounded-full after:content-[''] [@media(pointer:coarse)]:after:-inset-[7px]",
              dim,
              selected ? "ring-1 ring-foreground" : "hover:ring-1 hover:ring-foreground/40",
            )}
          >
            <span className={cn("size-full rounded-full border border-black/10", out && "opacity-60")} style={{ background: c.hex }} />
            {out && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <span className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-navy/70" />
              </span>
            )}
          </button>
        );
      })}
      {extra > 0 &&
        (moreHref ? (
          <Link href={moreHref} onClick={(e) => e.stopPropagation()} className="relative z-[2] ml-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
            {t("more", { count: extra })}
          </Link>
        ) : (
          <span className="ml-0.5 text-xs text-muted-foreground">{t("more", { count: extra })}</span>
        ))}
    </div>
  );
}
