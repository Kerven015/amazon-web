/**
 * Product validation (zod). Shared by the admin form (inline errors) and the
 * server API (the source of truth). Uniqueness of slug/SKU is checked on the server.
 */
import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max);
const optText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
const optNum = z.number().finite().nonnegative().optional();

/**
 * Text in every language. English is required where the field is; Turkish, Turkmen and
 * Russian are optional (fallback: English).
 */
const l10n = (max = 200, required?: string) =>
  z.object({
    en: required ? text(max).min(1, required) : text(max).default(""),
    tr: optText(max),
    tk: optText(max),
    ru: optText(max),
  });
const optL10n = (max = 200) =>
  z
    .object({ en: text(max).default(""), tr: optText(max), tk: optText(max), ru: optText(max) })
    .optional()
    .transform((v) => (v && (v.en || v.tr || v.tk || v.ru) ? v : undefined));
const l10nList = (max = 200, items = 12) =>
  z.object({
    en: z.array(text(max)).max(items).default([]),
    tr: z.array(text(max)).max(items).optional(),
    tk: z.array(text(max)).max(items).optional(),
    ru: z.array(text(max)).max(items).optional(),
  });
const nameL10n = z.object({ tr: optText(60), tk: optText(60), ru: optText(60) }).optional();

/**
 * Uploaded path (/images/…) or an http(s) URL. Never a data: URL — the store
 * draws its illustrations on the fly, and they must not be saved as photos.
 */
const imageSrc = z
  .string()
  .max(2_000, "Invalid image")
  .refine((s) => s === "" || s.startsWith("/") || /^https?:\/\//.test(s), "Invalid image");

export const imageSchema = z.object({
  src: imageSrc,
  alt: text(300).default(""),
  blurDataURL: z.string().max(4_000).optional(),
});

export const colorSchema = z.object({
  name: text(40).min(1, "Colour name is required"),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #c8b18e"),
  family: z.enum(["White", "Neutral", "Grey", "Black", "Green", "Blue", "Pink", "Red"]),
  image: imageSrc.default(""),
  imageBlur: z.string().max(4_000).optional(),
  images: z.array(imageSchema).max(8).optional(),
  labels: nameL10n,
});

export const sizeSchema = z
  .object({
    name: text(40).min(1, "Size name is required"),
    widthCm: optNum,
    lengthCm: optNum,
    note: optL10n(120),
    labels: nameL10n,
    price: z.number({ invalid_type_error: "Enter a price" }).finite().positive("Price must be more than 0"),
    salePrice: z.number().finite().positive("Sale price must be more than 0").optional(),
    stock: z.record(z.string(), z.number().int().min(0, "Stock can't be negative")),
  })
  .refine((s) => s.salePrice == null || s.salePrice < s.price, {
    message: "Sale price must be lower than the price",
    path: ["salePrice"],
  });

const reviewSchema = z.object({
  id: text(80).min(1),
  productId: text(80),
  author: text(80).default(""),
  rating: z.number().min(1).max(5),
  title: text(200).default(""),
  body: text(4000).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  verified: z.boolean().default(false),
  helpful: z.number().int().min(0).default(0),
  variant: optText(80),
  sizeBought: optText(40),
  colourBought: optText(40),
});

export const productSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/i, "Invalid id"),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required")
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
    sku: text(40).min(1, "SKU is required").regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dots, dashes only"),
    title: l10n(160, "Name is required"),
    tagline: l10n(120),
    description: l10n(5000),
    productType: text(60).min(1, "Choose a category"),
    categorySlug: text(60).min(1),
    collections: z.array(text(60)).max(10).optional(),
    feel: z.enum(["Light & airy", "Soft & cosy", "Plush & indulgent", "Crisp & structured", "Smooth & sleek"]),
    material: l10n(80, "Material is required"),
    weightGsm: z.number().int().positive("GSM must be more than 0").max(3000).optional(),
    weave: optL10n(80),
    origin: optL10n(120),
    design: z.enum(["Plain", "Textured", "Patterned"]),
    badge: z.enum(["NEW IN", "New Colour", "Bestseller"]).optional(),
    personalisable: z.boolean().optional(),
    brand: text(60).default(""),
    highlights: l10nList(200, 12),
    specs: z.array(z.object({ label: text(60), value: text(200) })).max(20).default([]),
    features: l10nList(80, 6),
    sizes: z.array(sizeSchema).min(1, "Add at least one size"),
    careInstructions: z
      .array(z.object({ kind: z.enum(["wash", "dry", "iron", "bleach", "dryclean"]), text: l10n(300) }))
      .max(10)
      .default([]),
    reviews: z.array(reviewSchema).max(200).default([]),
    images: z
      .array(imageSchema.extend({ src: imageSrc.refine((v) => v !== "", "Image is missing") }))
      // Optional: products without photos show an illustration in the store.
      .max(12, "Up to 12 images")
      .default([]),
    price: z.number().nonnegative(),
    listPrice: z.number().nonnegative().optional(),
    rating: z.number().min(0).max(5).default(0),
    reviewCount: z.number().int().min(0).default(0),
    stock: z.number().int().min(0).default(0),
    stockStatus: z.enum(["auto", "in", "low", "out"]).default("auto"),
    fastDelivery: z.boolean().default(true),
    variants: z.object({
      sizes: z.array(text(40)).optional(),
      colors: z.array(colorSchema).max(24).optional(),
    }),
    sellerId: text(40).default("s7"),
    tags: z.array(z.enum(["bestseller", "deal", "new"])).default([]),
    dealEndsInHours: z.number().optional(),
    boughtLastMonth: z.number().optional(),
    hidden: z.boolean().optional(),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .superRefine((p, ctx) => {
    const names = (p.variants.colors ?? []).map((c) => c.name.toLowerCase());
    names.forEach((n, i) => {
      if (names.indexOf(n) !== i) ctx.addIssue({ code: "custom", path: ["variants", "colors", i, "name"], message: "Colour names must be unique" });
    });
    const sizes = p.sizes.map((s) => s.name.toLowerCase());
    sizes.forEach((n, i) => {
      if (sizes.indexOf(n) !== i) ctx.addIssue({ code: "custom", path: ["sizes", i, "name"], message: "Size names must be unique" });
    });
  });

export type ProductInput = z.input<typeof productSchema>;

/** Field path → first message, e.g. { "title": "Name is required", "sizes.0.price": "…" } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
