import type {
  ColorOption,
  Feel,
  Product,
  ProductBadge,
  ProductImage,
  ProductSpec,
  ProductTag,
} from "@/types";
import { productArt } from "../art";
import creditsJson from "./image-credits.json";
import manifestJson from "./image-manifest.json";
import { averageRating, buildReviews, buildSizes, careFor, descriptionFor, fabricOf, featuresFor, highlightsFor, originFor, weaveFor } from "./product-details";
import { reviews as seededReviews } from "./reviews";

/* ------------------------------------------------------------------
   Compact seed table → expanded into full Product objects below.
   IDs (p1…p40) and order are stable so reviews/orders keep matching.
   Every product has editorial fields (tagline, feel, material, design)
   and colour variants carry a family (for the colour filter) and their
   own image (for swatch hover on cards).
------------------------------------------------------------------- */

type Design = Product["design"];

type Seed = {
  title: string;
  tagline: string;
  type: string;
  brand: string;
  price: number;
  listPrice?: number;
  rating: number;
  reviews: number;
  stock: number;
  fast: boolean;
  feel: Feel;
  material: string;
  gsm?: number;
  design?: Design;
  badge?: ProductBadge;
  tags?: ProductTag[];
  sizes?: string[];
  collections?: string[];
  personalisable?: boolean;
  colors?: (keyof typeof C)[];
  dealHours?: number;
};

const C = {
  chalk: { name: "Chalk", hex: "#f1ede4", family: "White" },
  oat: { name: "Oat", hex: "#d9cdb8", family: "Neutral" },
  sand: { name: "Sand", hex: "#c8b18e", family: "Neutral" },
  stone: { name: "Stone", hex: "#a9a196", family: "Grey" },
  slate: { name: "Slate", hex: "#5d6670", family: "Grey" },
  charcoal: { name: "Charcoal", hex: "#3a3836", family: "Black" },
  midnight: { name: "Midnight", hex: "#1f2226", family: "Black" },
  sage: { name: "Sage", hex: "#a3b19a", family: "Green" },
  olive: { name: "Olive", hex: "#6c6d3d", family: "Green" },
  lagoon: { name: "Lagoon", hex: "#2f6e66", family: "Green" },
  mist: { name: "Mist", hex: "#b7c6cf", family: "Blue" },
  ink: { name: "Ink", hex: "#2b3a55", family: "Blue" },
  blush: { name: "Blush", hex: "#e3c1b8", family: "Pink" },
  rose: { name: "Rose", hex: "#c98f8b", family: "Pink" },
  clay: { name: "Clay", hex: "#b06a4f", family: "Red" },
  rust: { name: "Rust", hex: "#94452c", family: "Red" },
} satisfies Record<string, Omit<ColorOption, "image">>;

const apparel = ["XS", "S", "M", "L", "XL"];
const shoes = ["7", "8", "9", "10", "11", "12"];
const towels = ["Face cloth", "Hand towel", "Bath towel", "Bath sheet"];
const allTones: (keyof typeof C)[] = ["chalk", "oat", "sand", "stone", "slate", "charcoal", "sage", "lagoon", "mist", "ink", "blush", "clay"];

const seeds: Record<string, { sellerId: string; items: Seed[] }> = {
  electronics: {
    sellerId: "s1",
    items: [
      { title: "Aurora Wireless Noise-Cancelling Headphones", tagline: "Quiet, all-day comfort", type: "Headphones", brand: "Lumina", price: 179.99, listPrice: 249.99, rating: 4.6, reviews: 3214, stock: 23, fast: true, feel: "Soft & cosy", material: "Recycled aluminium", tags: ["bestseller", "deal"], colors: ["midnight", "chalk", "lagoon", "sand"], dealHours: 6 },
      { title: "Pulse 2 Smartwatch with AMOLED Display", tagline: "Wellness, at a glance", type: "Wearables", brand: "Orbit", price: 129, listPrice: 159, rating: 4.3, reviews: 1876, stock: 41, fast: true, feel: "Smooth & sleek", material: "Silicone & steel", tags: ["deal"], colors: ["midnight", "rose", "slate", "sage"], dealHours: 11 },
      { title: "Nimbus 4K Streaming Stick", tagline: "Plug in, settle in", type: "Smart home", brand: "Lumina", price: 39.99, listPrice: 49.99, rating: 4.5, reviews: 8932, stock: 120, fast: true, feel: "Smooth & sleek", material: "Recycled plastic", tags: ["bestseller"], badge: "Bestseller" },
      { title: "Echo-Free USB-C Conference Microphone", tagline: "Clear calls, small desk", type: "Audio", brand: "Kestrel", price: 69.5, rating: 4.2, reviews: 412, stock: 8, fast: false, feel: "Crisp & structured", material: "Aluminium", tags: ["new"], badge: "NEW IN" },
      { title: "Slate 11-inch Tablet, 128 GB", tagline: "Read, sketch, unwind", type: "Tablets", brand: "Orbit", price: 299, listPrice: 349, rating: 4.4, reviews: 2290, stock: 15, fast: true, feel: "Smooth & sleek", material: "Aluminium", tags: ["deal"], colors: ["slate", "chalk", "sage"], dealHours: 20 },
    ],
  },
  fashion: {
    sellerId: "s2",
    items: [
      { title: "Everyday Organic Cotton Crew Tee", tagline: "The one you reach for first", type: "Tops", brand: "Arden & Co", price: 18, listPrice: 24, rating: 4.5, reviews: 5402, stock: 300, fast: true, feel: "Soft & cosy", material: "Organic cotton", gsm: 180, tags: ["bestseller"], badge: "New Colour", sizes: apparel, colors: ["chalk", "midnight", "olive", "sand", "sage", "ink", "clay", "blush", "stone"] },
      { title: "Trailline Waterproof Shell Jacket", tagline: "Weatherproof, featherweight", type: "Outerwear", brand: "Northpeak", price: 149, listPrice: 189, rating: 4.7, reviews: 980, stock: 34, fast: true, feel: "Light & airy", material: "Recycled nylon", tags: ["deal"], sizes: apparel, colors: ["lagoon", "rust", "midnight", "stone"], dealHours: 9 },
      { title: "Linen Blend Relaxed Trousers", tagline: "Easy summer tailoring", type: "Bottoms", brand: "Arden & Co", price: 54, rating: 4.1, reviews: 312, stock: 0, fast: false, feel: "Light & airy", material: "Linen blend", design: "Textured", tags: ["new"], badge: "NEW IN", sizes: apparel, colors: ["sand", "slate", "oat"] },
      { title: "Canvas Low-Top Sneakers", tagline: "Pared-back everyday pair", type: "Shoes", brand: "Vireo", price: 62, listPrice: 75, rating: 4.4, reviews: 2104, stock: 60, fast: true, feel: "Crisp & structured", material: "Organic cotton canvas", sizes: shoes, colors: ["chalk", "midnight", "sage"] },
      { title: "Merino Wool Beanie", tagline: "Warm without the itch", type: "Accessories", brand: "Northpeak", price: 26, rating: 4.6, reviews: 760, stock: 85, fast: true, feel: "Soft & cosy", material: "Merino wool", design: "Textured", colors: ["rust", "slate", "olive", "oat", "ink"] },
    ],
  },
  "home-kitchen": {
    sellerId: "s3",
    items: [
      { title: "Stoneware Pour-Over Coffee Set", tagline: "A slower morning ritual", type: "Kitchen", brand: "Halcyon", price: 48, listPrice: 64, rating: 4.8, reviews: 1320, stock: 22, fast: true, feel: "Crisp & structured", material: "Stoneware", design: "Textured", tags: ["bestseller", "deal"], colors: ["sand", "slate", "chalk", "sage"], dealHours: 4 },
      { title: "Pre-Seasoned Cast Iron Skillet, 10 inch", tagline: "Heirloom-ready cookware", type: "Kitchen", brand: "Tidewell", price: 34.99, rating: 4.7, reviews: 9821, stock: 140, fast: true, feel: "Crisp & structured", material: "Cast iron", tags: ["bestseller"], badge: "Bestseller" },
      { title: "Smart LED Desk Lamp with Wireless Charger", tagline: "Warm light, tidy desk", type: "Lighting", brand: "Lumina", price: 59, listPrice: 79, rating: 4.3, reviews: 845, stock: 3, fast: false, feel: "Smooth & sleek", material: "Aluminium", tags: ["deal"], colors: ["midnight", "chalk", "sage"], dealHours: 14 },
      { title: "Bamboo Bath Towel Collection", tagline: "Quick-dry family favourite", type: "Towels", brand: "Solace", price: 9, listPrice: 14, rating: 4.5, reviews: 1544, stock: 700, fast: true, feel: "Light & airy", material: "Bamboo-cotton blend", gsm: 550, tags: ["deal"], badge: "New Colour", sizes: towels, colors: allTones, dealHours: 18 },
      { title: "Glass Meal-Prep Containers, Set of 10", tagline: "Fridge to oven to table", type: "Kitchen", brand: "Tidewell", price: 29.99, listPrice: 39.99, rating: 4.4, reviews: 4410, stock: 200, fast: true, feel: "Crisp & structured", material: "Borosilicate glass", tags: ["deal"], dealHours: 22 },
    ],
  },
  beauty: {
    sellerId: "s4",
    items: [
      { title: "Hydra Calm Daily Moisturizer, 50 ml", tagline: "Weightless daily hydration", type: "Skincare", brand: "Solace", price: 24, rating: 4.5, reviews: 2780, stock: 150, fast: true, feel: "Light & airy", material: "Plant-based formula", tags: ["bestseller"], badge: "Bestseller" },
      { title: "Vitamin C Brightening Serum, 30 ml", tagline: "For a rested-looking glow", type: "Skincare", brand: "Brightleaf", price: 32, listPrice: 40, rating: 4.3, reviews: 1903, stock: 90, fast: true, feel: "Smooth & sleek", material: "Plant-based formula", tags: ["deal"], dealHours: 7 },
      { title: "Mineral Sunscreen SPF 50, Fragrance-Free", tagline: "Everyday, no white cast", type: "Skincare", brand: "Brightleaf", price: 19.5, rating: 4.6, reviews: 3620, stock: 210, fast: true, feel: "Light & airy", material: "Mineral formula" },
      { title: "Ionic Hair Dryer with Diffuser", tagline: "Fast, gentle, quiet", type: "Hair tools", brand: "Kestrel", price: 89, listPrice: 119, rating: 4.2, reviews: 702, stock: 18, fast: false, feel: "Smooth & sleek", material: "Recycled plastic", tags: ["deal"], colors: ["rose", "midnight", "chalk"], dealHours: 16 },
      { title: "Unscented Shea Body Butter, 8 oz", tagline: "Rich, slow-melting care", type: "Body", brand: "Solace", price: 16, rating: 4.7, reviews: 1188, stock: 0, fast: false, feel: "Plush & indulgent", material: "Shea butter" },
    ],
  },
  "sports-outdoors": {
    sellerId: "s2",
    items: [
      { title: "Non-Slip Yoga Mat, 6 mm", tagline: "Grounded, cushioned practice", type: "Yoga", brand: "Vireo", price: 38, listPrice: 48, rating: 4.6, reviews: 4312, stock: 95, fast: true, feel: "Soft & cosy", material: "Natural rubber", tags: ["bestseller"], badge: "New Colour", colors: ["lagoon", "rose", "slate", "sage", "oat", "ink", "clay"] },
      { title: "Adjustable Dumbbells, 5–25 lb Pair", tagline: "A whole rack in two", type: "Training", brand: "Kestrel", price: 219, listPrice: 279, rating: 4.5, reviews: 1630, stock: 12, fast: true, feel: "Crisp & structured", material: "Steel", tags: ["deal"], dealHours: 3 },
      { title: "Ultralight 2-Person Backpacking Tent", tagline: "Two minutes to pitch", type: "Camping", brand: "Northpeak", price: 189, rating: 4.6, reviews: 540, stock: 9, fast: false, feel: "Light & airy", material: "Ripstop nylon", tags: ["new"], badge: "NEW IN", colors: ["olive", "rust"] },
      { title: "Insulated Steel Water Bottle, 32 oz", tagline: "Cold for a whole day", type: "Hydration", brand: "Tidewell", price: 27, rating: 4.8, reviews: 11204, stock: 400, fast: true, feel: "Smooth & sleek", material: "Stainless steel", tags: ["bestseller"], colors: ["lagoon", "midnight", "chalk", "rust", "sage", "mist", "blush", "sand"] },
      { title: "Cushioned Trail Running Shoes", tagline: "Sure-footed on any path", type: "Shoes", brand: "Vireo", price: 109, listPrice: 135, rating: 4.4, reviews: 1290, stock: 44, fast: true, feel: "Soft & cosy", material: "Recycled mesh", tags: ["deal"], sizes: shoes, colors: ["slate", "lagoon", "midnight"], dealHours: 18 },
    ],
  },
  books: {
    sellerId: "s5",
    items: [
      { title: "The Quiet Craft: Notes on Making Things", tagline: "A gentle book about attention", type: "Non-fiction", brand: "Pagewright", price: 22, listPrice: 28, rating: 4.7, reviews: 2011, stock: 60, fast: true, feel: "Soft & cosy", material: "FSC paper", tags: ["bestseller"], badge: "Bestseller", sizes: ["Paperback", "Hardcover"] },
      { title: "Field Guide to Night Skies", tagline: "Stargazing, made simple", type: "Non-fiction", brand: "Pagewright", price: 18.99, rating: 4.8, reviews: 873, stock: 35, fast: true, feel: "Crisp & structured", material: "FSC paper" },
      { title: "Cooking with Five Ingredients", tagline: "Simple food, every night", type: "Cookbooks", brand: "Pagewright", price: 26, listPrice: 32, rating: 4.5, reviews: 1402, stock: 48, fast: true, feel: "Soft & cosy", material: "FSC paper", tags: ["deal"], sizes: ["Paperback", "Hardcover"], dealHours: 12 },
      { title: "Small Habits, Big Shifts", tagline: "Change that actually sticks", type: "Non-fiction", brand: "Pagewright", price: 16, rating: 4.3, reviews: 3301, stock: 120, fast: true, feel: "Light & airy", material: "FSC paper", tags: ["bestseller"] },
      { title: "The Cartographer's Daughter: A Novel", tagline: "A sweeping coastal story", type: "Fiction", brand: "Pagewright", price: 14.5, rating: 4.6, reviews: 990, stock: 75, fast: false, feel: "Soft & cosy", material: "FSC paper", tags: ["new"], badge: "NEW IN" },
    ],
  },
  "toys-games": {
    sellerId: "s6",
    items: [
      { title: "Magnetic Building Tiles, 100 Pieces", tagline: "Open-ended building play", type: "Building", brand: "Kindlewood", price: 49, listPrice: 69, rating: 4.8, reviews: 6120, stock: 80, fast: true, feel: "Crisp & structured", material: "BPA-free plastic", tags: ["bestseller", "deal"], dealHours: 5 },
      { title: "Wooden Balance Board", tagline: "Balance, rock, imagine", type: "Active play", brand: "Kindlewood", price: 58, rating: 4.6, reviews: 432, stock: 20, fast: false, feel: "Smooth & sleek", material: "FSC beech wood", colors: ["oat", "sage", "blush"] },
      { title: "Harbor Lights Strategy Board Game", tagline: "Family night, upgraded", type: "Games", brand: "Kindlewood", price: 39, listPrice: 44, rating: 4.5, reviews: 1278, stock: 55, fast: true, feel: "Crisp & structured", material: "Recycled board", tags: ["deal"], dealHours: 21 },
      { title: "Remote Control Stunt Car", tagline: "Flips, spins, giggles", type: "Remote control", brand: "Orbit", price: 45, listPrice: 59, rating: 4.1, reviews: 2033, stock: 6, fast: true, feel: "Crisp & structured", material: "ABS plastic", tags: ["deal"], colors: ["rust", "lagoon"], dealHours: 8 },
      { title: "1000-Piece Jigsaw Puzzle: Alpine Lake", tagline: "A slow, calming weekend", type: "Puzzles", brand: "Kindlewood", price: 21, rating: 4.7, reviews: 845, stock: 100, fast: true, feel: "Soft & cosy", material: "Recycled board", design: "Patterned", tags: ["new"], badge: "NEW IN" },
    ],
  },
  grocery: {
    sellerId: "s3",
    items: [
      { title: "Single-Origin Ground Coffee, 1 lb", tagline: "Cocoa, cherry, caramel", type: "Coffee & tea", brand: "Halcyon", price: 16.99, rating: 4.6, reviews: 4890, stock: 250, fast: true, feel: "Plush & indulgent", material: "Arabica beans", tags: ["bestseller"], sizes: ["Ground", "Whole bean"] },
      { title: "Organic Ceremonial Matcha Powder, 30 g", tagline: "Bright, grassy, calm", type: "Coffee & tea", brand: "Brightleaf", price: 28, listPrice: 34, rating: 4.5, reviews: 1122, stock: 65, fast: true, feel: "Smooth & sleek", material: "Organic tencha", tags: ["deal"], dealHours: 10 },
      { title: "Raw Wildflower Honey, 16 oz", tagline: "Floral, small-batch, raw", type: "Pantry", brand: "Brightleaf", price: 13.5, rating: 4.8, reviews: 2780, stock: 140, fast: true, feel: "Plush & indulgent", material: "Raw honey" },
      { title: "Cold-Pressed Extra Virgin Olive Oil, 1 L", tagline: "Peppery, green, everyday", type: "Pantry", brand: "Tidewell", price: 21, listPrice: 26, rating: 4.7, reviews: 3360, stock: 90, fast: true, feel: "Smooth & sleek", material: "Koroneiki olives", tags: ["deal"], dealHours: 15 },
      { title: "Mixed Nut Trail Mix, 2 lb", tagline: "Trail-ready, desk-approved", type: "Snacks", brand: "Tidewell", price: 18, rating: 4.4, reviews: 1904, stock: 180, fast: true, feel: "Crisp & structured", material: "Mixed nuts", tags: ["bestseller"] },
    ],
  },
  // Towel catalogue (p41+). Collections slugs are defined in lib/collections.ts.
  towels: {
    sellerId: "s7",
    items: [
      { title: "Organic Cotton Bath Towel", tagline: "Everyday softness, made to last", type: "Bath Towels", brand: "Loomhouse", price: 12, rating: 4.8, reviews: 6230, stock: 400, fast: true, feel: "Soft & cosy", material: "Organic cotton", gsm: 600, tags: ["bestseller"], badge: "Bestseller", sizes: towels, colors: allTones, collections: ["elevated-classics"], personalisable: true },
      { title: "Turkish Cotton Waffle Towel", tagline: "Quick-dry, light and airy", type: "Bath Towels", brand: "Loomhouse", price: 10, rating: 4.6, reviews: 2114, stock: 260, fast: true, feel: "Light & airy", material: "Turkish cotton", gsm: 380, design: "Textured", tags: ["new"], badge: "NEW IN", sizes: towels, colors: ["chalk", "oat", "sage", "mist", "blush", "stone", "clay"], collections: ["quick-drying", "wellness-spa"] },
      { title: "Supreme Plush Hotel Towel", tagline: "Deep, sink-in softness", type: "Bath Towels", brand: "Halcyon", price: 18, rating: 4.9, reviews: 3870, stock: 180, fast: true, feel: "Plush & indulgent", material: "Egyptian cotton", gsm: 750, tags: ["bestseller"], sizes: towels, colors: ["chalk", "oat", "stone", "charcoal", "ink", "sage"], collections: ["luxury", "wellness-spa"], personalisable: true },
      { title: "Ribbed Spa Towel", tagline: "Textured, thirsty, restorative", type: "Bath Towels", brand: "Solace", price: 14, listPrice: 20, rating: 4.7, reviews: 1290, stock: 140, fast: true, feel: "Plush & indulgent", material: "Turkish cotton", gsm: 650, design: "Textured", tags: ["deal"], sizes: towels, colors: ["chalk", "sand", "slate", "lagoon", "rose"], collections: ["wellness-spa", "luxury"], dealHours: 30 },
      { title: "Striped Hammam Towel", tagline: "Bath, beach or picnic blanket", type: "Bath Towels", brand: "Loomhouse", price: 22, rating: 4.5, reviews: 860, stock: 90, fast: true, feel: "Light & airy", material: "Turkish cotton", gsm: 280, design: "Patterned", badge: "New Colour", colors: ["ink", "clay", "sage", "charcoal", "blush", "mist"], collections: ["design-patterned", "quick-drying"] },
      { title: "Oversized Beach Towel", tagline: "Room to sprawl in the sun", type: "Beach Towels", brand: "Tidewell", price: 34, rating: 4.6, reviews: 1430, stock: 120, fast: true, feel: "Light & airy", material: "Cotton velour", gsm: 450, design: "Patterned", colors: ["mist", "clay", "sand", "lagoon"], collections: ["design-patterned"] },
      { title: "Sand-Free Microfibre Beach Towel", tagline: "Shakes clean, packs small", type: "Beach Towels", brand: "Tidewell", price: 26, listPrice: 32, rating: 4.4, reviews: 990, stock: 160, fast: true, feel: "Smooth & sleek", material: "Recycled microfibre", gsm: 220, tags: ["deal"], colors: ["ink", "lagoon", "blush", "sand"], collections: ["quick-drying"], dealHours: 40 },
      { title: "Hooded Baby Towel", tagline: "Snug after-bath cuddles", type: "Baby Towels", brand: "Kindlewood", price: 24, rating: 4.9, reviews: 2380, stock: 110, fast: true, feel: "Soft & cosy", material: "Organic cotton", gsm: 500, colors: ["chalk", "blush", "sage", "mist", "oat"], personalisable: true },
      { title: "Muslin Baby Wash Cloths, Set of 6", tagline: "Gentle on new skin", type: "Baby Towels", brand: "Kindlewood", price: 18, rating: 4.7, reviews: 1120, stock: 140, fast: true, feel: "Light & airy", material: "Organic cotton muslin", gsm: 160, colors: ["chalk", "blush", "sage"] },
      { title: "Linen Tea Towels, Set of 3", tagline: "Lint-free, gets better with age", type: "Kitchen Towels", brand: "Halcyon", price: 28, rating: 4.7, reviews: 1650, stock: 130, fast: true, feel: "Crisp & structured", material: "Washed linen", gsm: 200, design: "Patterned", colors: ["oat", "ink", "clay", "sage"], collections: ["design-patterned"] },
      { title: "Waffle Kitchen Towels, Set of 4", tagline: "Quick-dry for busy kitchens", type: "Kitchen Towels", brand: "Halcyon", price: 22, listPrice: 26, rating: 4.5, reviews: 870, stock: 150, fast: true, feel: "Light & airy", material: "Cotton waffle", gsm: 300, design: "Textured", tags: ["deal"], colors: ["chalk", "charcoal", "sage", "clay"], collections: ["quick-drying"], dealHours: 26 },
      { title: "Tufted Cotton Bath Mat", tagline: "Plush underfoot, quick to dry", type: "Bath Mats", brand: "Solace", price: 32, rating: 4.6, reviews: 1980, stock: 100, fast: true, feel: "Plush & indulgent", material: "Combed cotton", gsm: 1800, design: "Textured", colors: ["chalk", "oat", "stone", "sage", "ink", "blush"], collections: ["elevated-classics"] },
      { title: "Reversible Bath Rug", tagline: "Two looks, one rug", type: "Bath Mats", brand: "Loomhouse", price: 44, listPrice: 58, rating: 4.4, reviews: 640, stock: 4, fast: false, feel: "Soft & cosy", material: "Cotton chenille", gsm: 1400, design: "Patterned", tags: ["deal"], colors: ["sand", "slate", "clay"], collections: ["design-patterned"], dealHours: 18 },
      { title: "Waffle Bathrobe", tagline: "Featherlight spa-day robe", type: "Bathrobes", brand: "Solace", price: 68, rating: 4.7, reviews: 1540, stock: 80, fast: true, feel: "Light & airy", material: "Turkish cotton waffle", gsm: 320, design: "Textured", sizes: ["XS", "S", "M", "L", "XL"], colors: ["chalk", "oat", "sage", "charcoal"], collections: ["wellness-spa", "quick-drying"] },
      { title: "Plush Shawl-Collar Robe", tagline: "Wrapped-up weekend mornings", type: "Bathrobes", brand: "Halcyon", price: 92, rating: 4.8, reviews: 1210, stock: 60, fast: true, feel: "Plush & indulgent", material: "Egyptian cotton terry", gsm: 450, tags: ["new"], badge: "NEW IN", sizes: ["XS", "S", "M", "L", "XL"], colors: ["chalk", "stone", "ink", "blush"], collections: ["luxury", "wellness-spa"], personalisable: true },
      { title: "The Essentials Towel Bundle", tagline: "2 bath, 2 hand, 2 face", type: "Towel Bundles", brand: "Loomhouse", price: 64, listPrice: 76, rating: 4.8, reviews: 2940, stock: 200, fast: true, feel: "Soft & cosy", material: "Organic cotton", gsm: 600, tags: ["bestseller", "deal"], badge: "Bestseller", sizes: ["6-piece", "8-piece"], colors: allTones, collections: ["elevated-classics"], dealHours: 48 },
      { title: "Spa Weekend Bundle", tagline: "Robe, bath sheet and mat", type: "Towel Bundles", brand: "Halcyon", price: 138, rating: 4.9, reviews: 760, stock: 45, fast: true, feel: "Plush & indulgent", material: "Egyptian cotton", gsm: 750, colors: ["chalk", "stone", "ink"], collections: ["luxury", "wellness-spa"], personalisable: true },
      { title: "Guest Bathroom Bundle", tagline: "Quick-dry sets for visitors", type: "Towel Bundles", brand: "Solace", price: 48, rating: 4.5, reviews: 520, stock: 70, fast: false, feel: "Light & airy", material: "Turkish cotton", gsm: 420, sizes: ["4-piece", "6-piece"], colors: ["chalk", "sage", "mist", "oat"], collections: ["quick-drying"] },
    ],
  },
};

const highlightsByCategory: Record<string, string[]> = {
  electronics: ["Up to 30 hours of battery on a single charge", "Pairs instantly with phones, tablets and laptops", "Fast USB-C charging", "Two-year manufacturer warranty"],
  fashion: ["Breathable, durable fabric", "True to size — see size guide", "Machine washable", "Responsibly sourced materials"],
  "home-kitchen": ["Built for everyday use", "Easy to clean and care for", "Gets softer with every wash where noted", "Backed by a 1-year guarantee"],
  beauty: ["Dermatologist tested", "Suitable for sensitive skin", "Cruelty-free formula", "Recyclable packaging"],
  "sports-outdoors": ["Lightweight and durable construction", "Designed for training and travel", "Weather-resistant materials", "Easy to clean"],
  books: ["Clear, engaging writing", "Includes index and further reading", "Printed on responsibly sourced paper", "Ships in protective packaging"],
  "toys-games": ["Ages 4 and up", "Non-toxic, child-safe materials", "Encourages creativity and problem solving", "Storage bag included"],
  towels: ["OEKO-TEX certified, free from harmful substances", "Pre-washed for softness from day one", "Absorbent loops that get fluffier with every wash", "Free personalisation on selected styles"],
  grocery: ["Small-batch and responsibly sourced", "No artificial flavours or preservatives", "Resealable packaging", "Best-by date at least 6 months out"],
};

function specsFor(seed: Seed, index: number): ProductSpec[] {
  const specs: ProductSpec[] = [
    { label: "Brand", value: seed.brand },
    { label: "Model", value: `${seed.brand.slice(0, 3).toUpperCase()}-${1000 + index * 37}` },
    { label: "Material", value: seed.material },
    { label: "Feel", value: seed.feel },
  ];
  if (seed.gsm) specs.push({ label: "Weight", value: `${seed.gsm} GSM` });
  if (seed.sizes) specs.push({ label: "Options", value: seed.sizes.join(", ") });
  return specs;
}


/* ------------------------------------------------------------------
   Product photos
   scripts/fetch-product-images.ts downloads Pexels photos into
   public/images/products/{slug}/ and writes image-manifest.json
   (paths + blur placeholders) and image-credits.json. Until a product
   has an entry, its images have src "" and the UI shows a cream tile.
------------------------------------------------------------------- */

export type ManifestImage = { src: string; blurDataURL?: string };
export type ManifestEntry = {
  main?: ManifestImage;
  gallery?: ManifestImage[];
  /** keyed by colour slug, e.g. "sage" */
  colors?: Record<string, ManifestImage>;
};
export type ImageCredit = {
  productId: string;
  file: string;
  pexelsId: number;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
};

export const imageManifest = manifestJson as Record<string, ManifestEntry>;
export const imageCredits = creditsJson as ImageCredit[];

/** Calm tones for illustrating products that have no colour variants. */
const FALLBACK_TONES = ["#d9cdb8", "#a3b19a", "#b7c6cf", "#e3c1b8", "#c8b18e", "#a9a196", "#b06a4f", "#2b3a55"];

/** Plain colour words that search well on Pexels (our colour names are poetic). */
export const colorSearchTerms: Record<string, string> = {
  Chalk: "white",
  Oat: "beige",
  Sand: "sand beige",
  Stone: "light grey",
  Slate: "grey",
  Charcoal: "dark grey",
  Midnight: "black",
  Sage: "sage green",
  Olive: "olive green",
  Lagoon: "teal",
  Mist: "light blue",
  Ink: "navy blue",
  Blush: "pale pink",
  Rose: "dusty pink",
  Clay: "terracotta",
  Rust: "rust orange",
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function altFor(title: string, type: string, colour?: string, view?: number) {
  const base = colour ? `${title} in ${colour} – ${type}` : `${title} – ${type}`;
  return view ? `${base}, view ${view}` : base;
}

let counter = 0;

/** The day the mock data was generated ("today" for review dates and launch dates). */
export const SEED_TODAY = new Date(Date.UTC(2026, 9, 13));

/** Towel launch dates (all in the past). NEW IN items (p42, p55) launched in the last 30 days. */
export const TOWEL_LAUNCH: Record<string, string> = Object.fromEntries(
  Object.entries({
    p14: "2026-08-18", p41: "2026-03-02", p42: "2026-09-22", p43: "2026-03-20", p44: "2026-04-08", p45: "2026-08-25",
    p46: "2026-05-02", p47: "2026-05-19", p48: "2026-04-14", p49: "2026-06-03", p50: "2026-06-20", p51: "2026-07-01",
    p52: "2026-04-27", p53: "2026-07-15", p54: "2026-07-29", p55: "2026-10-02", p56: "2026-03-10", p57: "2026-08-05", p58: "2026-09-01",
  }).map(([id, d]) => [id, `${d}T09:00:00.000Z`]),
);

const allProducts: Product[] = Object.entries(seeds).flatMap(([categorySlug, group]) =>
  group.items.map((seed) => {
    counter += 1;
    const id = `p${counter}`;
    const entry = imageManifest[id] ?? {};
    const mainColour = seed.colors ? C[seed.colors[0]].name : undefined;
    const design = seed.design ?? "Plain";

    // Built-in illustration in a given colour, used until a real photo exists (lib/art.ts)
    const fallbackHex = FALLBACK_TONES[counter % FALLBACK_TONES.length];
    const mainHex = seed.colors ? C[seed.colors[0]].hex : fallbackHex;
    const palette = (seed.colors ?? []).slice(1, 3).map((k) => C[k].hex);
    const art = (hex: string, view = 0) => productArt({ type: seed.type, design, color: hex, palette, view, seed: id });

    const images: ProductImage[] = entry.main
      ? [
          { src: entry.main.src, alt: altFor(seed.title, seed.type, mainColour), blurDataURL: entry.main.blurDataURL },
          ...(entry.gallery ?? []).map((g, i) => ({
            src: g.src,
            alt: altFor(seed.title, seed.type, mainColour, i + 2),
            blurDataURL: g.blurDataURL,
          })),
        ]
      : [0, 1, 2].map((view) => ({ src: art(mainHex, view), alt: altFor(seed.title, seed.type, mainColour, view ? view + 1 : undefined) }));

    const colors: ColorOption[] | undefined = seed.colors?.map((key, i) => {
      if (!entry.main) {
        const views = [0, 1, 2].map((view) => ({ src: art(C[key].hex, view), alt: altFor(seed.title, seed.type, C[key].name, view ? view + 1 : undefined) }));
        return { ...C[key], image: views[0].src, images: views };
      }
      // First colour uses the main photo; a missing colour photo falls back to the main one.
      const own = i === 0 ? entry.main : (entry.colors?.[slugify(C[key].name)] ?? entry.main);
      return { ...C[key], image: own.src, imageBlur: own.blurDataURL };
    });
    // Detail-page fields: sizes with prices + stock per colour, features, care, reviews
    const colourNames = (seed.colors ?? []).map((k) => C[k].name);
    const sizes = buildSizes({ id, type: seed.type, price: seed.price, listPrice: seed.listPrice, stock: seed.stock, sizes: seed.sizes, colours: colourNames });
    const effective = sizes.map((s) => s.salePrice ?? s.price);
    const cheapest = sizes[effective.indexOf(Math.min(...effective))];
    const totalStock = sizes.reduce((n, s) => n + Object.values(s.stock).reduce((a, b) => a + b, 0), 0);
    const isTextile = categorySlug === "towels" || seed.type === "Towels";
    const weave = isTextile ? weaveFor(seed.title, seed.material) : undefined;
    const fabric = fabricOf({ type: seed.type, material: seed.material, weave, title: seed.title });
    const highlights = isTextile ? highlightsFor({ fabric, personalisable: seed.personalisable }) : (highlightsByCategory[categorySlug] ?? []);
    const own = seededReviews.filter((r) => r.productId === id);

    // Launch dates: all in the past; "NEW IN" products within the last 30 days
    const created = TOWEL_LAUNCH[id] ?? new Date(Date.UTC(2026, 0, 5) + counter * 2 * 86_400_000).toISOString();
    return {
      id,
      slug: slugify(seed.title),
      title: seed.title,
      tagline: seed.tagline,
      productType: seed.type,
      feel: seed.feel,
      material: seed.material,
      weightGsm: seed.gsm,
      design,
      badge: seed.badge,
      collections: seed.collections,
      personalisable: seed.personalisable,
      brand: seed.brand,
      categorySlug,
      description: isTextile
        ? descriptionFor({ title: seed.title, brand: seed.brand, tagline: seed.tagline, gsm: seed.gsm, feel: seed.feel, material: seed.material, fabric })
        : `${seed.title} from ${seed.brand} is made to be lived with: considered materials, quiet details and a finish that gets better with use. Sold and shipped by an independent maker on our marketplace, with free returns and buyer protection on every order.`,
      highlights,
      specs: specsFor(seed, counter),
      weave,
      origin: isTextile ? originFor(seed.material) : undefined,
      features: featuresFor({ isTextile, material: seed.material, gsm: seed.gsm, quickDry: seed.feel === "Light & airy" || !!seed.collections?.includes("quick-drying"), highlights }),
      sizes,
      careInstructions: careFor(isTextile, seed.material, fabric),
      reviews: own,
      images,
      price: cheapest.salePrice ?? cheapest.price,
      listPrice: cheapest.salePrice ? cheapest.price : undefined,
      rating: seed.rating,
      reviewCount: seed.reviews,
      stock: totalStock,
      fastDelivery: seed.fast,
      variants: { sizes: seed.sizes, colors },
      sellerId: group.sellerId,
      tags: seed.tags ?? [],
      dealEndsInHours: seed.dealHours,
      boughtLastMonth: undefined,
      createdAt: created,
    } satisfies Product;
  }),
);

/**
 * The store sells towels only. The original demo items (electronics, books…) were
 * removed from the live catalogue; their seeds stay above so product ids are stable.
 * The Bamboo Bath Towel (p14) moves into the towel range.
 */
/** The towel range before reviews are attached (ratings are the targets the review generator aims for). */
export const towelRange: Product[] = allProducts
  .filter((p) => p.categorySlug === "towels" || p.productType === "Towels")
  .map((p) => (p.id === "p14" ? { ...p, categorySlug: "towels", productType: "Bath Towels", sellerId: "s7", collections: ["quick-drying"] } : p));

/** Reviews are generated for the whole range at once so no text repeats between products. */
export const reviewInput = (p: Product) => ({
    id: p.id,
    title: p.title,
    productType: p.productType,
    material: p.material,
    weave: p.weave,
    design: p.design,
    gsm: p.weightGsm,
    rating: p.rating,
    createdAt: p.createdAt,
    sizes: p.sizes.map((s) => ({ name: s.name, note: s.note, stock: s.stock })),
    colours: (p.variants.colors ?? []).map((c) => c.name),
});
const generated = buildReviews(towelRange.map(reviewInput), SEED_TODAY);

/** reviewCount and rating are the real count and average of the reviews that exist. */
export const products: Product[] = towelRange.map((p) => {
  const reviews = p.reviews.length ? p.reviews : (generated.get(p.id) ?? []);
  return { ...p, reviews, reviewCount: reviews.length, rating: averageRating(reviews, p.rating) };
});
