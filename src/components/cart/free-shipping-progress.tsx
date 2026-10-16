import { motion } from "motion/react";
import { Gift, Truck } from "lucide-react";
import { AnimatedNumber } from "@/components/motion-ui/animated-number";
import { siteConfig } from "@/lib/config";
import { cn, formatPrice } from "@/lib/utils";
import { formatPriceShort, useT } from "@/i18n";

const milestones = [
  { at: siteConfig.freeShippingThreshold, key: "freeDelivery", icon: Truck },
  { at: siteConfig.freeGiftThreshold, key: "freeGift", icon: Gift },
];

/**
 * "You are $X away from free standard delivery" with milestone markers.
 * The fill and the amount animate (Animated Number).
 */
export function FreeShippingProgress({ subtotal, className }: { subtotal: number; className?: string }) {
  const max = milestones[milestones.length - 1].at;
  const pct = Math.min(100, (subtotal / max) * 100);
  const next = milestones.find((m) => subtotal < m.at);
  const remaining = next ? next.at - subtotal : 0;
  const t = useT("cart.progress");

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm" aria-live="polite">
        {next ? (
          t.rich(next.key === "freeDelivery" ? "awayDelivery" : "awayGift", {
            amount: (
              <span className="font-medium">
                <AnimatedNumber value={remaining} format={(v) => formatPrice(Math.max(0, v))} />
              </span>
            ),
          })
        ) : (
          t("unlocked")
        )}
      </p>
      <div className="relative pb-6">
        <div
          className="h-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label={t("label")}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.min(subtotal, max)}
          aria-valuetext={formatPrice(Math.min(subtotal, max))}
        >
          <motion.div
            className="h-full rounded-full bg-foreground"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        {milestones.map((m) => {
          const left = (m.at / max) * 100;
          const reached = subtotal >= m.at;
          return (
            <div
              key={m.at}
              className="absolute top-0 flex -translate-x-full flex-col items-end"
              style={{ left: `${left}%` }}
            >
              <span
                className={cn(
                  "-mt-1.5 grid size-4 place-items-center rounded-full border transition-colors duration-300",
                  reached ? "border-foreground bg-foreground text-background" : "border-input bg-surface text-muted-foreground",
                )}
                aria-hidden="true"
              >
                <m.icon className="size-2.5" />
              </span>
              {/* Just the short price under the icon; the sentence above says what it unlocks */}
              <span className={cn("price mt-1 whitespace-nowrap text-[11px]", reached ? "text-foreground" : "text-muted-foreground")} title={t(m.key)}>
                <span className="sr-only">{t(m.key)}: </span>
                {formatPriceShort(m.at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
