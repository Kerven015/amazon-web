/**
 * Prices, discounts, delivery and totals — plain functions with no browser or
 * React dependencies, so the server recalculates every order with exactly the
 * same rules the bag and checkout show.
 */
import { siteConfig } from "./config";

export type DeliveryOption = (typeof siteConfig.deliveryOptions)[number];
export type DeliveryId = DeliveryOption["id"];

export const deliveryOptions = siteConfig.deliveryOptions;

export function deliveryOption(id: string): DeliveryOption | undefined {
  return deliveryOptions.find((d) => d.id === id);
}

/** Shipping cost for an option, given the bag total after discounts (standard is free over the threshold). */
export function deliveryPrice(id: DeliveryId, discountedSubtotal: number): number {
  const opt = deliveryOption(id)!;
  if (opt.price !== null) return opt.price;
  return discountedSubtotal === 0 || discountedSubtotal >= siteConfig.freeShippingThreshold ? 0 : siteConfig.standardShipping;
}

/** Adds Monday–Friday days (weekends are skipped). */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/** Earliest and latest arrival for an option ordered at `from`. */
export function deliveryDates(id: DeliveryId, from = new Date()) {
  const opt = deliveryOption(id)!;
  return { earliest: addBusinessDays(from, opt.minDays), latest: addBusinessDays(from, opt.maxDays) };
}

/** Price for a size: { price (what you pay), listPrice (struck through when on sale) }. */
export function sizePrice(size: { price: number; salePrice?: number }) {
  return size.salePrice != null && size.salePrice < size.price
    ? { price: size.salePrice, listPrice: size.price }
    : { price: size.price, listPrice: undefined };
}

/** Percent off for a discount code, or 0 when the code doesn't exist. */
export function discountPercent(code: string | null | undefined) {
  return code ? (siteConfig.discountCodes[code.trim().toUpperCase()] ?? 0) : 0;
}

/** Discount in money for a subtotal (rounded to cents). */
export function discountAmount(subtotal: number, code: string | null | undefined) {
  return Math.round(subtotal * discountPercent(code)) / 100;
}

/**
 * Prices are tax-inclusive. `tax` is the portion of the total that is tax
 * (shown as "includes $X tax"); it is not added on top.
 */
export function computeTotals(subtotal: number, shippingOverride?: number, discount = 0) {
  const discounted = Math.max(0, subtotal - discount);
  const shipping =
    shippingOverride ??
    (subtotal === 0 || discounted >= siteConfig.freeShippingThreshold ? 0 : siteConfig.standardShipping);
  const tax = Math.round((discounted - discounted / (1 + siteConfig.taxRate)) * 100) / 100;
  return {
    subtotal,
    discount,
    shipping,
    tax,
    total: Math.round((discounted + shipping) * 100) / 100,
  };
}
