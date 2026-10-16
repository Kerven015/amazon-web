/**
 * Translations + locale-aware formatting.
 *
 *   const t = useT();             t("productPage.addToBag")
 *   const t = useT("cart");       t("title"), t("items", { count: 3 })
 *   translate("toasts.added")     outside React (toasts, loaders)
 *
 * Messages live in /messages/{en,tr,tk,ru}.json (ICU format, same as next-intl).
 * A missing key falls back to English and warns once in development.
 */
import { createContext, Fragment, type ReactNode, useContext, useMemo } from "react";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import tk from "../../messages/tk.json";
import tr from "../../messages/tr.json";
import { defaultLocale, type Locale, localizePath } from "./config";
import { formatMessage } from "./icu";

export * from "./config";

type Messages = Record<string, unknown>;
const catalogs: Record<Locale, Messages> = { en, tr, tk, ru };

/* ------------------------------ active locale ------------------------------ */

let active: Locale = defaultLocale;

/** Set by the /:locale route before loaders/render; used by non-React helpers. */
export function setActiveLocale(locale: Locale) {
  active = locale;
}
export const getActiveLocale = () => active;

/* ------------------------------ lookup ------------------------------ */

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as object)) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

const warned = new Set<string>();

/** Raw message (no formatting), falling back to English. */
export function rawMessage(key: string, locale: Locale = active): string | undefined {
  const own = lookup(catalogs[locale], key);
  if (own !== undefined && own !== "") return own;
  if (import.meta.env?.DEV && locale !== "en" && !warned.has(`${locale}:${key}`)) {
    warned.add(`${locale}:${key}`);
    console.warn(`[i18n] Missing ${locale} translation: ${key}`);
  }
  return lookup(catalogs.en, key);
}

/** Array/object message (e.g. month names). */
export function messageValue<T = unknown>(key: string, locale: Locale = active): T | undefined {
  const read = (m: Messages) => {
    let node: unknown = m;
    for (const part of key.split(".")) {
      if (node && typeof node === "object" && part in (node as object)) node = (node as Record<string, unknown>)[part];
      else return undefined;
    }
    return node as T;
  };
  return read(catalogs[locale]) ?? read(catalogs.en);
}

export type TValues = Record<string, string | number | undefined | null>;

export function translate(key: string, values?: TValues, locale: Locale = active): string {
  const msg = rawMessage(key, locale);
  if (msg === undefined) {
    if (import.meta.env?.DEV && !warned.has(`en:${key}`)) {
      warned.add(`en:${key}`);
      console.warn(`[i18n] Missing message: ${key}`);
    }
    return key;
  }
  return formatMessage(msg, values, locale, (n) => formatNumber(n, locale));
}

/* ------------------------------ formatting ------------------------------ */

const intlLocale = (locale: Locale) => locale;
const supports = new Map<string, boolean>();
/** Whether this browser's Intl has data for the locale (Turkmen is missing in some). */
export function intlSupports(locale: Locale) {
  if (!supports.has(locale)) {
    let ok = false;
    try {
      ok = Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 && new Intl.DateTimeFormat(locale).resolvedOptions().locale.startsWith(locale);
    } catch {
      ok = false;
    }
    supports.set(locale, ok);
  }
  return supports.get(locale)!;
}
/** Locale to use for numbers: Turkmen falls back to Turkish formatting when unsupported. */
const numberLocale = (locale: Locale) => (locale === "tk" && !intlSupports("tk") ? "tr" : intlLocale(locale));

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    nfCache.set(key, f);
  }
  return f;
}

export function formatNumber(n: number, locale: Locale = active, opts: Intl.NumberFormatOptions = {}) {
  return nf(numberLocale(locale), opts).format(n);
}

/** USD with the locale's number style: en "$24.00", tr/tk/ru "24,00 $". */
export function formatPrice(value: number, locale: Locale = active) {
  if (locale === "en") return nf("en-US", { style: "currency", currency: "USD" }).format(value);
  return `${nf(numberLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}\u00a0$`;
}

/** Whole amounts without ".00" (size buttons): "$6" / "6 $". */
export function formatPriceShort(value: number, locale: Locale = active) {
  if (!Number.isInteger(value)) return formatPrice(value, locale);
  if (locale === "en") return `$${nf("en-US", {}).format(value)}`;
  return `${nf(numberLocale(locale), {}).format(value)}\u00a0$`;
}

const cap = (s: string, locale: Locale = active) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

/**
 * Dates with Intl in the current language. When the browser has no Turkmen data,
 * month and weekday names come from tk.json (dates.months / dates.weekdays).
 */
export function formatDate(input: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }, locale: Locale = active) {
  const d = typeof input === "string" ? new Date(input) : input;
  const o: Intl.DateTimeFormatOptions = { timeZone: typeof input === "string" && !opts.timeZone ? "UTC" : opts.timeZone, ...opts };
  if (locale !== "tk" || intlSupports("tk")) {
    const out = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : locale, o).format(d);
    if (locale === "tk") return out.replace(/(^|\s)([a-zäçňöşüýž])/g, (_m, s: string, c: string) => s + c.toUpperCase());
    // Russian weekdays are lower-case mid-sentence; at the start of a date they're capitalised: "Вт, 14 окт."
    if (locale === "ru" && o.weekday) return cap(out, "ru");
    return out;
  }
  // Manual Turkmen formatting: "Sşn 14 Okt" / "14 Oktýabr 2026"
  const parts = new Intl.DateTimeFormat("en-US", { ...o, weekday: undefined, month: "numeric", day: "numeric", year: "numeric" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const months = messageValue<string[]>(o.month === "long" ? "dates.months" : "dates.monthsShort", "tk") ?? [];
  const wd = messageValue<string[]>(o.weekday === "long" ? "dates.weekdays" : "dates.weekdaysShort", "tk") ?? [];
  const weekdayIndex = new Date(Date.UTC(get("year"), get("month") - 1, get("day"))).getUTCDay();
  return [o.weekday ? wd[weekdayIndex] : "", o.day ? String(get("day")) : "", o.month ? months[get("month") - 1] : "", o.year ? String(get("year")) : ""]
    .filter(Boolean)
    .join(" ");
}

/** "Sun" / "Paz" / "Ýek" / "Вт" */
export function formatWeekday(d: Date, locale: Locale = active) {
  return cap(formatDate(d, { weekday: "short", timeZone: undefined }, locale), locale);
}

/** Uppercase with the language's rules (Turkish i → İ; Cyrillic for Russian) — badges. */
export function upper(text: string, locale: Locale = active) {
  return text.toLocaleUpperCase(locale);
}

/**
 * Case- and accent-insensitive search key in any script:
 * "Havlu" ≈ "havlu", "Ýumşak" ≈ "yumsak", "ı/İ" ≈ "i", "Полотенце" ≈ "полотенце", "ё" ≈ "е".
 */
export function searchKey(text: string) {
  return text
    .replace(/[İIı]/g, (c) => (c === "ı" ? "i" : c === "İ" ? "i" : "I"))
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents, plus й → и and ё → е
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/* ------------------------------ React ------------------------------ */

type Ctx = { locale: Locale; prefix: boolean };
const I18nContext = createContext<Ctx>({ locale: defaultLocale, prefix: false });

/**
 * `prefix` = links get the /{locale} prefix (shop). The admin uses
 * <I18nProvider locale="en" prefix={false}> so its links stay /admin/….
 */
export function I18nProvider({
  locale,
  prefix = true,
  scoped = false,
  children,
}: {
  locale: Locale;
  prefix?: boolean;
  /** Only affects the components inside (admin preview) — leaves the page's active language alone. */
  scoped?: boolean;
  children: React.ReactNode;
}) {
  if (!scoped) setActiveLocale(locale);
  const value = useMemo(() => ({ locale, prefix }), [locale, prefix]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useLocale = () => useContext(I18nContext).locale;
export const useI18nContext = () => useContext(I18nContext);

/** Translator for the current language; pass a namespace to shorten keys. */
export function useT(namespace?: string) {
  const { locale } = useContext(I18nContext);
  return useMemo(() => {
    const t = (key: string, values?: TValues) => translate(namespace ? `${namespace}.${key}` : key, values, locale);
    /** Like t(), but returns undefined instead of the key when missing. */
    t.has = (key: string) => rawMessage(namespace ? `${namespace}.${key}` : key, locale) !== undefined;
    /**
     * Message with React elements in it, keeping each language's word order:
     * t.rich("away", { amount: <AnimatedNumber … /> }) for "You are {amount} away…".
     */
    t.rich = (key: string, slots: Record<string, ReactNode>, values: TValues = {}) => {
      const marks: TValues = { ...values };
      for (const name of Object.keys(slots)) marks[name] = `\u0000${name}\u0000`;
      const text = t(key, marks);
      return text.split("\u0000").map((part, i) => (i % 2 ? <Fragment key={i}>{slots[part]}</Fragment> : part));
    };
    return t;
  }, [locale, namespace]);
}

/** Href helper: "/cart" → "/tr/cart" in the shop, unchanged in the admin. */
export function useHref() {
  const { locale, prefix } = useContext(I18nContext);
  return (path: string) => (prefix ? localizePath(path, locale) : path);
}
