import { useEffect, useRef } from "react";
import { I18nProvider, type Locale, locales, useT } from "@/i18n";
import { useAdminLocale } from "@/lib/admin-locale";
import { cn } from "@/lib/utils";

const AMBER = "#d97706";

/**
 * Every admin page renders inside this: the admin's own language (not the shop's), no URL
 * prefix on links, <html lang> kept in sync, and Alt+1…Alt+4 switching the language anywhere.
 */
export function AdminI18n({ children }: { children: React.ReactNode }) {
  const locale = useAdminLocale((s) => s.locale);
  const setLocale = useAdminLocale((s) => s.setLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Alt+1…Alt+4 → EN / TR / TK / RU (e.code, so it also works with Option on a Mac)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const n = locales.findIndex((_, i) => e.code === `Digit${i + 1}`);
      if (n < 0) return;
      e.preventDefault();
      setLocale(locales[n]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setLocale]);

  return (
    <I18nProvider locale={locale} prefix={false}>
      {children}
    </I18nProvider>
  );
}

/**
 * EN | TR | TK | RU as a radio group (arrow keys move). Without `value` it's the admin's
 * interface language (top bar). The product form passes `value`/`onChange` to pick which
 * language of the product text is being edited — that never changes the interface. An amber
 * dot marks a language whose product text still has empty fields.
 */
export function AdminLanguageSwitcher({
  missing,
  className,
  value,
  onChange,
  label,
}: {
  missing?: Partial<Record<Locale, number>>;
  className?: string;
  value?: Locale;
  onChange?: (locale: Locale) => void;
  label?: string;
}) {
  const t = useT("admin.switcher");
  const adminLocale = useAdminLocale((s) => s.locale);
  const setAdminLocale = useAdminLocale((s) => s.setLocale);
  const locale = value ?? adminLocale;
  const setLocale = onChange ?? setAdminLocale;
  const interfaceSwitcher = !onChange;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = locales.indexOf(locale);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? locales.length - 1 : step ? (i + step + locales.length) % locales.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setLocale(locales[to]);
    refs.current[locales[to]]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label ?? t("label")}
      data-language-switcher
      onKeyDown={onKeyDown}
      className={cn("inline-flex shrink-0 rounded-full border border-navy/15 bg-surface p-0.5", className)}
    >
      {locales.map((l, n) => {
        const on = locale === l;
        const count = missing?.[l] ?? 0;
        return (
          <button
            key={l}
            ref={(el) => {
              refs.current[l] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => setLocale(l)}
            title={`${l.toUpperCase()}${interfaceSwitcher ? ` (Alt+${n + 1})` : ""}${count ? ` — ${t("empty", { count })}` : ""}`}
            className={cn(
              "relative inline-flex h-7 min-w-9 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold tracking-wide transition-colors sm:min-w-11 sm:gap-1.5 sm:px-3",
              on ? "bg-navy text-cream" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.toUpperCase()}
            {count > 0 && (
              <>
                <span className="size-1.5 rounded-full" style={{ background: AMBER }} aria-hidden="true" />
                <span className="sr-only">({t("empty", { count })})</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
