import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export function StepIndicator({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (i: number) => void;
}) {
  const t = useT("checkout");
  return (
    <nav aria-label={t("progress")}>
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onStepClick?.(i)}
                aria-current={active ? "step" : undefined}
                className="group flex items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground group-hover:bg-primary-hover",
                    active && "border-primary bg-card text-primary",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "sr-only text-sm font-semibold sm:not-sr-only",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                  {done && <span className="sr-only"> ({t("completed")})</span>}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-border sm:mx-3" aria-hidden="true">
                  <motion.span
                    className="block h-full origin-left bg-primary"
                    initial={false}
                    animate={{ scaleX: done ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {/* Phones show only the numbers above, so name the current step here */}
      <p className="mt-3 text-sm font-medium sm:hidden" aria-hidden="true">
        {t("stepOf", { n: current + 1, total: steps.length, label: steps[current] })}
      </p>
    </nav>
  );
}
