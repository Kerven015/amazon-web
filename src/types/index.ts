export type CategoryIcon =
  | "electronics"
  | "fashion"
  | "home"
  | "beauty"
  | "sports"
  | "books"
  | "toys"
  | "grocery"
  | "bath";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: CategoryIcon;
  image: string;
  blurb: string;
}

export interface Seller {
  id: string;
  name: string;
  slug: string;
  rating: number;
  ratingCount: number;
  positivePercent: number;
  joined: string; // ISO date
  location: string;
  responseTime: string;
}

export type ColorFamily =
  | "White"
  | "Neutral"
  | "Grey"
  | "Black"
  | "Green"
  | "Blue"
  | "Pink"
  | "Red";

export interface ColorOption {
  /** Stable English name — used as the key for stock, URLs (?colour=sand) and the bag */
  name: string;
  /** Display name in the current language (set when the product is localized) */
  label?: string;
  hex: string;
  family: ColorFamily;
  /** Image src shown when this colour's swatch is selected ("" = no photo yet → fallback tile) */
  image: string;
  /** Tiny blurred preview for next/image placeholder="blur" */
  imageBlur?: string;
  /** Full gallery for this colour (product page). Falls back to `image` + the product gallery. */
  images?: ProductImage[];
}

/** A product photo. The first item in Product.images is the main image. */
export interface ProductImage {
  /** Local path under /public, e.g. /images/products/{slug}/main.webp ("" = missing → fallback tile) */
  src: string;
  /** "{Product name} in {colour} – {category}" */
  alt: string;
  blurDataURL?: string;
}

export interface ProductVariants {
  sizes?: string[];
  colors?: ColorOption[];
}

export interface ProductSpec {
  label: string;
  value: string;
}

export type ProductTag = "bestseller" | "deal" | "new";

/** Editorial badge shown top-left on cards (sale % is derived from price). */
export type ProductBadge = "NEW IN" | "New Colour" | "Bestseller";

export type Feel = "Light & airy" | "Soft & cosy" | "Plush & indulgent" | "Crisp & structured" | "Smooth & sleek";

/** One purchasable size, with its own price and stock per colour. */
export interface ProductSize {
  /** Stable English name ("Bath towel") — the key used by the bag and filters */
  name: string;
  /** Display name in the current language (set when the product is localized) */
  label?: string;
  widthCm?: number;
  lengthCm?: number;
  /** Free text when width × length doesn't fit, e.g. "2 bath, 2 hand, 2 face" */
  note?: string;
  /** Regular price */
  price: number;
  /** Sale price (shown with the regular price struck through) */
  salePrice?: number;
  /** Units in stock keyed by colour name ("default" when the product has no colours) */
  stock: Record<string, number>;
}

export type StockStatus = "auto" | "in" | "low" | "out";

export type CareKind = "wash" | "dry" | "iron" | "bleach" | "dryclean";

export interface CareInstruction {
  kind: CareKind;
  text: string;
  /** English text (care symbols read "Do not…" / "40°C" from it) */
  textEn?: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  /** Short line shown above the name on cards, e.g. "Quick-dry family favourite" */
  tagline: string;
  /** Product type within the category, used by "Shop by Product" chips */
  productType: string;
  feel: Feel;
  material: string;
  /** English material name — the stable value used by the Material filter */
  materialKey?: string;
  /** Fabric weight for textiles, in GSM */
  weightGsm?: number;
  /** e.g. "Zero-twist terry loop" */
  weave?: string;
  /** e.g. "Woven in Denizli, Türkiye" */
  origin?: string;
  /** 3–4 short selling points shown as icon rows */
  features: string[];
  /** English features (icons are picked from these) */
  featuresEn?: string[];
  /** Sizes with dimensions, prices and stock per colour. Always at least one entry. */
  sizes: ProductSize[];
  careInstructions: CareInstruction[];
  /** Mock reviews (a real API would page these separately) */
  reviews: Review[];
  /** Hidden in the admin → 404 on the storefront */
  hidden?: boolean;
  /** Stock-keeping unit, unique per product */
  sku?: string;
  /** "auto" (default) derives availability from quantities; the others override it */
  stockStatus?: StockStatus;
  design: "Plain" | "Textured" | "Patterned";
  badge?: ProductBadge;
  /** Editorial collection slugs (see lib/collections.ts), e.g. "luxury", "quick-drying" */
  collections?: string[];
  /** Can be embroidered with initials */
  personalisable?: boolean;
  brand: string;
  categorySlug: string;
  description: string;
  highlights: string[];
  specs: ProductSpec[];
  /** First item is the main image; the rest are gallery images. */
  images: ProductImage[];
  price: number;
  listPrice?: number;
  rating: number;
  reviewCount: number;
  stock: number;
  fastDelivery: boolean;
  variants: ProductVariants;
  sellerId: string;
  tags: ProductTag[];
  /** Hours from "now" until the deal ends (mock only; a real API returns an ISO timestamp). */
  dealEndsInHours?: number;
  boughtLastMonth?: number;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  helpful: number;
  variant?: string;
  sizeBought?: string;
  colourBought?: string;
}

export interface SelectedVariant {
  size?: string;
  color?: string;
}

export interface CartItem {
  /** productId + variant key; unique per line */
  lineId: string;
  productId: string;
  title: string;
  /** Main (or selected colour) image src; "" shows the fallback tile */
  image: string;
  imageBlur?: string;
  price: number;
  listPrice?: number;
  quantity: number;
  stock: number;
  variant: SelectedVariant;
  sellerName: string;
  fastDelivery: boolean;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault?: boolean;
}

export type OrderStatus =
  | "placed"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  variant?: SelectedVariant;
  sellerName: string;
}

export interface TrackingEvent {
  status: OrderStatus;
  label: string;
  date?: string;
  location?: string;
  done: boolean;
}

export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  /** Money off from a discount code */
  discount?: number;
  shipping: number;
  tax: number;
  total: number;
  address: Address;
  paymentMethod: string;
  deliveryOption: string;
  estimatedDelivery: string;
  tracking: TrackingEvent[];
  /** Present on seller-side order views */
  customerName?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  addresses: Address[];
}

export type SortOption = "recommended" | "price-asc" | "price-desc" | "newest" | "bestselling";

export interface SearchParams {
  q?: string;
  category?: string;
  deals?: boolean;
}

export interface SellerStats {
  revenue: number;
  revenueChange: number;
  orders: number;
  ordersChange: number;
  conversion: number;
  conversionChange: number;
  rating: number;
  ratingChange: number;
  salesByDay: { day: string; value: number }[];
}

/* ------------------------------------------------------------------
   Stored product (data/products.json, admin API).
   Shopper-facing text is kept per language; the browser turns a record into
   a plain `Product` in the current language (src/lib/localize.ts), falling
   back to English for anything not translated yet.
------------------------------------------------------------------- */

export type LocaleCode = "en" | "tr" | "tk" | "ru";
/** Languages translated from English (everything except the default). */
export type TranslatedLocale = Exclude<LocaleCode, "en">;
/** { en: "Bath towel", tr: "Banyo havlusu", tk: "Hammam elsüpürgiji", ru: "Банное полотенце" } — English required */
export type L10n = { en: string } & Partial<Record<TranslatedLocale, string>>;
export type L10nList = { en: string[] } & Partial<Record<TranslatedLocale, string[]>>;
/** Translations of a stable English name (colours, sizes) */
export type NameL10n = Partial<Record<TranslatedLocale, string>>;

export interface ColorRecord extends Omit<ColorOption, "label"> {
  labels?: NameL10n;
}

export interface SizeRecord extends Omit<ProductSize, "label" | "note"> {
  labels?: NameL10n;
  note?: L10n;
}

export interface ProductRecord
  extends Omit<
    Product,
    "title" | "tagline" | "description" | "features" | "featuresEn" | "highlights" | "material" | "materialKey" | "weave" | "origin" | "careInstructions" | "sizes" | "variants"
  > {
  title: L10n;
  tagline: L10n;
  description: L10n;
  features: L10nList;
  highlights: L10nList;
  material: L10n;
  weave?: L10n;
  origin?: L10n;
  careInstructions: { kind: CareKind; text: L10n }[];
  sizes: SizeRecord[];
  variants: { sizes?: string[]; colors?: ColorRecord[] };
}
