/**
 * Delivery speeds, prices and dates — everything reads siteConfig.deliveryOptions,
 * so the product page, checkout, help and confirmation always agree.
 * All day counts are business days (Monday–Friday).
 */
import { formatDate, formatWeekday, translate, type Locale } from "@/i18n";

export { addBusinessDays, deliveryDates, deliveryOption, deliveryOptions, deliveryPrice, type DeliveryId, type DeliveryOption } from "@/lib/pricing";
import { deliveryDates, deliveryOption, type DeliveryId } from "@/lib/pricing";

/** "3–5 business days" / "1 business day", in the current (or given) language. */
export function deliveryDays(id: DeliveryId, locale?: Locale) {
  const opt = deliveryOption(id)!;
  return opt.minDays === opt.maxDays
    ? translate("checkout.deliveryDaysOne", { days: opt.maxDays }, locale)
    : translate("checkout.deliveryDays", { min: opt.minDays, max: opt.maxDays }, locale);
}

/** "Standard" */
export const deliveryName = (id: DeliveryId, locale?: Locale) => translate(`checkout.delivery.${id}.label`, undefined, locale);

/** "3–5 business days · fewer boxes" (the extra note only where an option has one). */
export const deliveryDetail = (id: DeliveryId, locale?: Locale) => translate(`checkout.delivery.${id}.detail`, { days: deliveryDays(id, locale) }, locale);

/**
 * Arrival range as dates in the current language: "Tue 14 – Thu 16 Oct"
 * (or "Thu 30 Oct – Mon 3 Nov" across months). Turkmen weekday/month names
 * come from tk.json when the browser has no Turkmen dates.
 */
export function dateRange(a: Date, b: Date, locale?: Locale) {
  const mo = (d: Date) => formatDate(d, { month: "short", timeZone: undefined }, locale).replace(/\.$/, "");
  const wd = (d: Date) => formatWeekday(d, locale);
  if (a.toDateString() === b.toDateString()) return `${wd(b)} ${b.getDate()} ${mo(b)}`;
  const left = `${wd(a)} ${a.getDate()}${a.getMonth() === b.getMonth() ? "" : ` ${mo(a)}`}`;
  return `${left} – ${wd(b)} ${b.getDate()} ${mo(b)}`;
}

/** When an option ordered at `from` arrives: "Tue 14 – Thu 16 Oct". */
export function deliveryWindow(id: DeliveryId, from = new Date(), locale?: Locale) {
  const { earliest, latest } = deliveryDates(id, from);
  return dateRange(earliest, latest, locale);
}
