/**
 * Small building blocks shared by the admin tool pages (dashboard, orders, inventory,
 * reviews, reports, activity): page header, filter chips, stat tiles, empty / error states
 * and a one-series bar chart.
 */
import { AlertTriangle, Eraser, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { adminApi, type Clearable } from "@/lib/admin-api";
import { useT, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";
import type { L10n } from "@/types";

/** A product name in the admin's language (English when there's no translation). */
export const pick = (text: L10n | null | undefined, locale: Locale) => (text ? ((text as Record<string, string | undefined>)[locale] || text.en) : "—");

export function AdminPageHeader({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Pill-shaped filter buttons (one selected). */
export function FilterChips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
            value === o.value ? "border-navy bg-navy text-cream" : "border-navy/20 hover:border-navy",
          )}
        >
          {o.label} {o.count != null && <span className="opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A headline number with a label (and an optional line under it). */
export function StatTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "warning" | "danger" }) {
  return (
    <div className={cn("rounded-sm border bg-card p-4", tone === "warning" && "border-warning/50", tone === "danger" && "border-danger/50")}>
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="price mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm border bg-card p-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useT("admin.common");
  return (
    <div role="alert" className="flex flex-wrap items-center justify-center gap-3 rounded-sm border border-danger/40 bg-danger-soft/40 p-6 text-sm">
      <AlertTriangle className="size-4 text-danger" aria-hidden="true" /> {t("loadFailed")}
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function Loading() {
  const t = useT("admin.common");
  return (
    <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {t("loading")}
    </p>
  );
}

/**
 * One series of bars over time (e.g. sales per day). Hover or focus a bar for its value;
 * the same numbers are in a table for screen readers.
 */
export function BarChart({ data, label, format, formatKey }: { data: { key: string; value: number }[]; label: string; format: (n: number) => string; formatKey: (k: string) => string }) {
  const t = useT("admin.common");
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const shown = active != null ? data[active] : null;
  return (
    <figure className="rounded-sm border bg-card p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="price text-muted-foreground" aria-live="polite">
          {shown ? `${formatKey(shown.key)}: ${format(shown.value)}` : t("chartMax", { value: format(max) })}
        </span>
      </figcaption>
      <div className="relative h-40" aria-hidden="true">
        {/* Recessive baseline and mid grid line */}
        <div className="absolute inset-x-0 bottom-0 border-t border-foreground/20" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/10" />
        <div className="absolute inset-0 flex items-end gap-0.5">
          {data.map((d, i) => (
            <div
              key={d.key}
              className="flex h-full flex-1 items-end"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className={cn("w-full rounded-t-[4px] bg-navy transition-opacity", active != null && active !== i && "opacity-40")}
                style={{ height: max ? `${Math.max((d.value / max) * 100, d.value ? 2 : 0)}%` : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
        <span>{data[0] && formatKey(data[0].key)}</span>
        <span>{data.at(-1) && formatKey(data.at(-1)!.key)}</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{formatKey(d.key)}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Table shell used by every admin list. */
export function AdminTable({ minWidth = 760, head, children }: { minWidth?: number; head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-sm border bg-card">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th scope="col" className={cn("px-4 py-3 font-medium", right && "text-right")}>
    {children}
  </th>
);

/**
 * "Clear history" for one admin section: shows how many rows will be deleted from the
 * database, asks for confirmation, deletes them and reports the result.
 */
export function ClearHistoryButton({ what, onCleared }: { what: Clearable; onCleared?: () => void | Promise<void> }) {
  const t = useT("admin.clearHistory");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { count } = await adminApi.historyCount(what);
      if (!count) return void toast.info(t("nothing"));
      if (!window.confirm(t(`confirm.${what}`, { count }))) return;
      const { removed } = await adminApi.clearHistory(what);
      toast.success(t("done", { count: removed }));
      await onCleared?.();
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy} title={t(`hint.${what}`)} className="hover:!border-danger hover:!bg-danger hover:!text-white">
      {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Eraser aria-hidden="true" />} {t("button")}
    </Button>
  );
}
