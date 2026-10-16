import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDate as i18nFormatDate, formatNumber } from "@/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* Locale-aware formatting lives in src/i18n (prices: en "$24.00", tr/tk "24,00 $"). */
export { formatPrice, formatPriceShort } from "@/i18n";

export function discountPercent(price: number, listPrice?: number) {
  if (!listPrice || listPrice <= price) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}

export function formatCompact(value: number) {
  return formatNumber(value, undefined, { notation: "compact", maximumFractionDigits: 1 });
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return i18nFormatDate(iso, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC", ...opts });
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "Organic Cotton Bath Towel" → "organic-cotton-bath-towel" */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
