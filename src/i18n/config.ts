/**
 * Languages. English is the default; every shop URL starts with the code:
 * /en/…, /tr/…, /tk/…, /ru/… (the admin at /admin is English only).
 */
/** Order = order in the language switcher. */
export const locales = ["en", "tr", "tk", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Cookie that remembers the shopper's choice (read by the server for the first redirect too). */
export const LOCALE_COOKIE = "vendora_locale";

export const localeNames: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
  tk: "Türkmençe",
  ru: "Русский",
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (locales as readonly string[]).includes(v);

/**
 * Pick a language from an Accept-Language header or navigator.languages:
 * tr → Turkish, tk → Turkmen, ru → Russian, en → English, taking the shopper's
 * preference order. If none of those appear, Ukrainian, Belarusian, Kazakh or Uzbek
 * speakers get Russian (the language they most likely read); anything else → English.
 */
export function negotiateLocale(header: string | readonly string[] | null | undefined): Locale {
  const list = Array.isArray(header)
    ? header.map((tag, i) => ({ tag, q: 1 - i / 100 }))
    : String(header ?? "")
        .split(",")
        .map((part) => {
          const [tag, ...params] = part.trim().split(";");
          const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
          return { tag, q: q ? Number(q.slice(2)) || 0 : 1 };
        });
  const sorted = list.filter((x) => x.tag && x.q > 0).sort((a, b) => b.q - a.q);
  const bases = sorted.map(({ tag }) => tag.toLowerCase().split("-")[0]);
  for (const base of bases) if (isLocale(base)) return base;
  if (bases.some((b) => RUSSIAN_READERS.has(b))) return "ru";
  return defaultLocale;
}

/** Browser languages whose speakers usually read Russian (used only when no better match). */
const RUSSIAN_READERS = new Set(["uk", "be", "kk", "uz"]);

/** Paths that never get a language prefix. */
export const UNPREFIXED = /^\/(admin|api|images|assets|favicon\.svg|robots\.txt|sitemap\.xml)(\/|$)/;

const LOCALE_PREFIX = new RegExp(`^/(${locales.join("|")})(?=/|$)(.*)$`);

/** "/tr/products/x" → { locale: "tr", rest: "/products/x" } */
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const m = pathname.match(LOCALE_PREFIX);
  if (!m) return { locale: null, rest: pathname || "/" };
  return { locale: m[1] as Locale, rest: m[2] || "/" };
}

/** Add the language prefix to an internal path ("/cart" → "/tr/cart"). */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//") || UNPREFIXED.test(path)) return path;
  const { rest } = splitLocale(path);
  return `/${locale}${rest === "/" ? "" : rest}`;
}
