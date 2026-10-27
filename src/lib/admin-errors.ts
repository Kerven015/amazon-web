/**
 * Validation (src/lib/product-schema.ts) and server messages are English, so the API stays
 * stable. The admin shows them in its own language by looking them up here.
 */
import { translate } from "@/i18n";

const KEYS: Record<string, string> = {
  "Image data is too large": "imageTooLarge",
  "Invalid image": "invalidImage",
  "Colour name is required": "colourNameRequired",
  "Size name is required": "sizeNameRequired",
  "Enter a price": "enterPrice",
  "Expected number, received nan": "enterPrice",
  "Price must be more than 0": "pricePositive",
  "Sale price must be more than 0": "salePositive",
  "Stock can't be negative": "stockNegative",
  "Sale price must be lower than the price": "saleLower",
  "Slug is required": "slugRequired",
  "Use lowercase letters, numbers and hyphens": "slugFormat",
  "SKU is required": "skuRequired",
  "Letters, numbers, dots, dashes only": "skuFormat",
  "Name is required": "nameRequired",
  "Choose a category": "chooseCategory",
  "Material is required": "materialRequired",
  "GSM must be more than 0": "gsmPositive",
  "Add at least one size": "addSize",
  "Image is missing": "imageMissing",
  "Up to 12 images": "maxImages",
  "Colour names must be unique": "colourUnique",
  "Size names must be unique": "sizeUnique",
  "This slug is already used by another product": "slugTaken",
  "This SKU is already used by another product": "skuTaken",
  "A product with this id already exists": "idTaken",
  "Invalid id": "invalidId",
  "Not found": "notFound",
  "Cross-origin request blocked": "crossOrigin",
  "Incorrect username or password": "wrongCredentials",
  "Not signed in": "notSignedIn",
  "No products selected": "noneSelected",
  "This product can no longer be restored": "cannotRestore",
  "Something went wrong on the server": "server",
  "Please fix the highlighted fields": "../toasts.fixFields",
  "The file is empty": "fileEmpty",
  "Images must be 5MB or smaller": "fileTooLarge",
  "Only JPG, PNG or WebP images are allowed": "fileType",
  "That file couldn't be read as an image": "fileUnreadable",
};

/** English message → the admin's language (unknown messages are shown as they are). */
export function adminError(message: string): string {
  const key = KEYS[message];
  if (key) return translate(key.startsWith("../") ? `admin.${key.slice(3)}` : `admin.errors.${key}`);
  const many = message.match(/^Too many attempts\. Try again in (\d+) minutes?\.$/);
  if (many) return translate("admin.errors.tooMany", { minutes: Number(many[1]) });
  if (message.startsWith("Admin login isn't configured")) return translate("admin.errors.notConfigured");
  // zod's built-in "too long" text (zod 3: "…at most 80 character(s)", zod 4: "…to have <=80 characters")
  if (/at most \d+ character|have <=\d+ character/.test(message)) return translate("admin.errors.tooLong");
  return message;
}

/** Same, for a whole { field: message } map from the form or the server. */
export const adminErrors = (fields: Record<string, string>) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, adminError(v)]));
