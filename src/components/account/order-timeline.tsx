import { motion } from "motion/react";
import { Check, CircleDot } from "lucide-react";
import { useMounted } from "@/lib/hooks/use-mounted";
import { cn } from "@/lib/utils";
import type { TrackingEvent } from "@/types";
import { formatDate, useT } from "@/i18n";
import { statusLabel } from "@/lib/order-format";

const fmt = (iso: string) => formatDate(new Date(iso), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Vertical tracking timeline with staggered reveal. */
export function OrderTimeline({ events }: { events: TrackingEvent[] }) {
  const mounted = useMounted();
  const currentIndex = events.reduce((last, e, i) => (e.done ? i : last), -1);
  const t = useT("orders");

  return (
    <ol className="relative space-y-0" aria-label={t("tracking")}>
      {events.map((e, i) => {
        const current = i === currentIndex;
        return (
          <motion.li
            key={e.status}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className="relative flex gap-3 pb-6 last:pb-0"
          >
            {i < events.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5", events[i + 1].done ? "bg-primary" : "bg-border")}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2",
                e.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                current && "ring-4 ring-primary-soft",
              )}
            >
              {e.done ? <Check className="size-3.5" aria-hidden="true" /> : <CircleDot className="size-3" aria-hidden="true" />}
            </span>
            <div className="pt-0.5">
              <p className={cn("text-sm font-semibold", !e.done && "text-muted-foreground")}>
                {statusLabel(e.status)}
                {current && <span className="ml-2 rounded-xs bg-cream px-1.5 py-0.5 text-[11px] text-navy ring-1 ring-navy/15">{t("current")}</span>}
                <span className="sr-only">{e.done ? ` — ${t("completed")}` : ` — ${t("pending")}`}</span>
              </p>
              {(e.date || e.location) && (
                <p className="text-xs text-muted-foreground">
                  {e.date && mounted && fmt(e.date)}
                  {e.date && e.location && " · "}
                  {e.location}
                </p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
