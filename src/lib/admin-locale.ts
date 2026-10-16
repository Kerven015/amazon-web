/**
 * The admin panel's language — separate from the shop's (which comes from the /en, /tr…
 * URL prefix). Chosen with the admin's EN | TR | TK | RU switcher and kept in a cookie
 * (`admin_locale`) plus localStorage, so it survives refresh, logout/login and moving
 * between products. Default: English.
 */
import { create } from "zustand";
import { isLocale, type Locale, setActiveLocale } from "@/i18n";

export const ADMIN_LOCALE_COOKIE = "admin_locale";
const STORAGE_KEY = "vendora-admin-locale";

function readSaved(): Locale {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(new RegExp(`(?:^|; )${ADMIN_LOCALE_COOKIE}=([^;]*)`));
    const fromCookie = m ? decodeURIComponent(m[1]) : null;
    if (isLocale(fromCookie)) return fromCookie;
  }
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (isLocale(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

type AdminLocaleState = { locale: Locale; setLocale: (l: Locale) => void };

export const useAdminLocale = create<AdminLocaleState>()((set) => ({
  locale: readSaved(),
  setLocale: (locale) => {
    if (typeof document !== "undefined") {
      document.cookie = `${ADMIN_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = locale;
    }
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* storage unavailable */
    }
    // Toasts and other text built outside React use the active language
    setActiveLocale(locale);
    set({ locale });
  },
}));

/** For loaders and other non-React code. */
export const getAdminLocale = () => useAdminLocale.getState().locale;
