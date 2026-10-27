/**
 * Store-wide settings. Rename the store by changing `name` here.
 */
export const siteConfig = {
  name: "Vendora",
  currency: "USD",
  /** Free standard delivery milestone */
  freeShippingThreshold: 50,
  /** Free gift milestone shown on the bag progress bar */
  freeGiftThreshold: 80,
  standardShipping: 4.95,
  /**
   * The one source for delivery speeds and prices (product page, checkout, help,
   * confirmation, orders). Days are business days (Mon–Fri). `price: null` = the
   * standard rate, free over freeShippingThreshold. Labels: checkout.delivery.{id}.
   */
  deliveryOptions: [
    { id: "fast", price: 9.99, minDays: 1, maxDays: 2 },
    { id: "standard", price: null, minDays: 3, maxDays: 5 },
    { id: "eco", price: 0, minDays: 6, maxDays: 8 },
  ] as { id: "fast" | "standard" | "eco"; price: number | null; minDays: number; maxDays: number }[],
  /** ISO country codes we deliver to (names: countries.{code} in messages). */
  shippingCountries: ["US"] as readonly string[],
  /** Prices are shown tax-inclusive; this rate is used to show the tax portion. */
  taxRate: 0.08,
  supportEmail: "help@vendora.example",
  /** Real social profiles. Leave a value empty to hide its icon in the footer. */
  social: { instagram: "", facebook: "", youtube: "" } as Record<"instagram" | "facebook" | "youtube", string>,
  /** Mock discount codes accepted in the bag (code → percent off) */
  discountCodes: { WELCOME10: 10, VENDORA15: 15 } as Record<string, number>,
  /** Shown after signing up for the newsletter ("10% off your first order") */
  welcomeCode: "WELCOME10",
} as const;

/** Announcement bar: texts are in messages/*.json → header.announcements.{key} */
export const announcements = [
  { key: "delivery", href: "/help/returns" },
  { key: "newColours", href: "/search?sort=newest" },
  { key: "quiz", href: "#quiz" },
] as const;
