/**
 * Request bodies for customer accounts, the bag, addresses, reviews and orders (zod).
 * The server validates every request with these; the browser reuses the shared rules
 * (e.g. the password length) so both sides agree.
 */
import { z } from "zod";
import { siteConfig } from "./config";

export const PASSWORD_MIN = 8;
/** Argon2 handles any length, but there's no reason to accept megabytes. */
const PASSWORD_MAX = 200;

const email = z.string().trim().toLowerCase().max(254).email();
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const name = z.string().trim().min(1).max(80);
const locale = z.enum(["en", "tr", "tk", "ru"]);
const productId = z.string().regex(/^[a-z0-9-]{1,40}$/i);
const variantName = z.string().trim().max(40);

export const registerSchema = z.object({ name, email, password, locale: locale.default("en") });
export const loginSchema = z.object({ email, password: z.string().min(1).max(PASSWORD_MAX), remember: z.boolean().default(false) });

export const profileSchema = z
  .object({ name: name.optional(), email: email.optional(), locale: locale.optional(), currentPassword: z.string().max(PASSWORD_MAX).optional() })
  .refine((v) => v.name !== undefined || v.email !== undefined || v.locale !== undefined, { message: "Nothing to change" });

export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(PASSWORD_MAX), newPassword: password });

/** Same rules as the checkout form (lib/store/addresses.ts → validateAddress). */
export const addressSchema = z.object({
  label: z.string().trim().max(40).default(""),
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(20),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .refine((c) => siteConfig.shippingCountries.includes(c), "We don't deliver there yet"),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((p) => p.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const addressPatchSchema = addressSchema.partial();

export const cartLineSchema = z.object({
  productId,
  size: variantName.optional(),
  colour: variantName.optional(),
  quantity: z.number().int().min(1).max(10),
});
export const cartSchema = z.object({ items: z.array(cartLineSchema).max(100), mode: z.enum(["replace", "merge"]).default("replace") });

export const wishlistSchema = z.object({ ids: z.array(productId).max(500), mode: z.enum(["replace", "merge"]).default("replace") });

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(10).max(1000),
  author: z.string().trim().min(1).max(40).optional(),
});

export const orderSchema = z
  .object({
    items: z.array(cartLineSchema).min(1).max(50),
    addressId: z.string().uuid().optional(),
    address: addressSchema.omit({ isDefault: true }).optional(),
    deliveryOption: z.enum(siteConfig.deliveryOptions.map((d) => d.id) as [string, ...string[]]),
    discountCode: z.string().trim().max(40).optional(),
    // Display only — card numbers never reach the server
    payment: z.object({ method: z.enum(["card", "wallet"]), last4: z.string().regex(/^\d{4}$/).optional() }),
  })
  .refine((o) => !!o.addressId !== !!o.address, { message: "Send either addressId or address", path: ["address"] });
export type OrderInput = z.infer<typeof orderSchema>;

export const orderStatusSchema = z.object({ status: z.enum(["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"]) });

/** Error codes the API returns; the browser shows messages → accountErrors.{code}. */
export type ApiErrorCode =
  | "validation"
  | "email_taken"
  | "invalid_credentials"
  | "too_many_attempts"
  | "account_blocked"
  | "sign_in_required"
  | "wrong_password"
  | "out_of_stock"
  | "invalid_discount"
  | "address_not_found"
  | "already_reviewed"
  | "not_found"
  | "forbidden"
  | "server_error";

/** Only paths on this site: "/en/checkout" yes; "//evil.com", "https://…", "/\\evil" no. */
export function safeNext(next: string | null | undefined, fallback = "/account") {
  if (!next || next.length > 500) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://vendora.local");
    if (u.origin !== "http://vendora.local") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
