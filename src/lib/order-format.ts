/**
 * Orders store codes, not sentences, so they read correctly in every language:
 *   deliveryOption: "fast" | "standard" | "eco"
 *   paymentMethod:  "card:Visa:4417" | "wallet"
 *   status:         "placed" | "packed" | …
 */
import { getActiveLocale, rawMessage, translate } from "@/i18n";
import { deliveryDetail, deliveryName, deliveryOption } from "@/lib/delivery";
import type { Address, OrderStatus } from "@/types";

/** "Standard — 3–5 business days" (from siteConfig.deliveryOptions). */
export function deliveryLabel(code: string) {
  const opt = deliveryOption(code);
  return opt ? `${deliveryName(opt.id)} — ${deliveryDetail(opt.id)}` : code;
}

/** Country name in the current language: "US" → "США". Older orders stored the English name; shown as is. */
export function countryName(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const locale = getActiveLocale();
  if (rawMessage(`countries.${code}`, locale)) return translate(`countries.${code}`);
  try {
    return new Intl.DisplayNames([locale, "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Street, city, region and postal code on one line. */
export const addressLine = (a: Address) => [a.line1, a.line2, a.city, [a.region, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export function paymentLabel(code: string) {
  if (code === "wallet") return translate("checkout.payment.walletShort");
  const [kind, brand, last4] = code.split(":");
  if (kind === "card") return translate("checkout.payment.cardEnding", { brand: brand === "Card" ? translate("checkout.payment.card") : brand, last4 });
  return code;
}

export const statusLabel = (status: OrderStatus) => translate(`orders.status.${status}`);

/** "Home" / "Work" are shown translated; other labels are shown as typed. */
export const addressLabel = (a: Pick<Address, "label">) =>
  a.label === "home" || a.label === "work" ? translate(`account.addressLabels.${a.label}`) : a.label;
