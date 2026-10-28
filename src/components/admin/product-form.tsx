import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";
import { toast } from "sonner";
import { AdminCardProvider } from "@/components/admin/admin-card-context";
import { type Deletable, DeleteDialog } from "@/components/admin/delete-products";
import { ImageManager } from "@/components/admin/image-manager";
import { NavIcon } from "@/components/ui/nav-icon";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/input";
import { AdminLanguageSwitcher } from "@/components/admin/admin-i18n";
import { useNavText } from "@/components/layout/mega-menu";
import { I18nProvider, locales, translate, useT } from "@/i18n";
import { adminError } from "@/lib/admin-errors";
import { useAdminLocale } from "@/lib/admin-locale";
import { ApiError, adminApi } from "@/lib/admin-api";
import { listRecords, refreshCatalog, withArtwork } from "@/lib/catalog";
import { localizeProduct, missingTranslations, translatedLocales } from "@/lib/localize";
import { siteConfig } from "@/lib/config";
import { mainNav, type NavLink } from "@/lib/navigation";
import { fieldErrors, productSchema } from "@/lib/product-schema";
import { sizePrice } from "@/lib/product-utils";
import { care as careDict, colours as colourDict, materials as materialDict, origins as originDict, sizes as sizeDict, suggestName, suggestText, weaves as weaveDict } from "@/lib/term-translations";
import { cn, discountPercent, slugify } from "@/lib/utils";
import type { CareKind, ColorFamily, ColorRecord, Feel, L10n, L10nList, LocaleCode, NameL10n, ProductBadge, ProductRecord, SizeRecord, StockStatus, TranslatedLocale } from "@/types";
import { ADMIN_BASE } from "@/lib/admin-path";

type Lang = LocaleCode;
/** Languages translated from English (all switcher options except EN) */
const EXTRA = translatedLocales;
/** Fill each translated language from `from` only where `into` is empty */
const mergeEmpty = <V extends Partial<Record<TranslatedLocale, string>>>(into: V | undefined, from: Partial<Record<TranslatedLocale, string>>) => {
  const out: Partial<Record<TranslatedLocale, string>> = { ...into };
  for (const l of EXTRA) out[l] = into?.[l] || from[l];
  return out;
};
/** Language name in the admin's current language ("Turkish" / "турецкий") */
const langName = (l: Lang) => translate(`admin.languages.${l}`);

/* ------------------------------ options (from lib/navigation.ts) ------------------------------ */

const navGroup = (heading: string): NavLink[] =>
  mainNav.find((i) => i.id === "towels")?.groups?.find((g) => g.heading === heading)?.links ?? [];
const slugOf = (href: string) => href.split("?")[0].split("/").pop() ?? "";

/** "Shop By Category" collection → product type stored on the product */
const CATEGORY_TYPE: Record<string, string> = {
  "towel-bundles": "Towel Bundles",
  "bath-towels": "Bath Towels",
  "beach-towels": "Beach Towels",
  "baby-towels": "Baby Towels",
  "kitchen-towels": "Kitchen Towels",
  "bath-mats-rugs": "Bath Mats",
  "bath-robes": "Bathrobes",
};
/** "Shop By Size" collection → size name + default dimensions */
const SIZE_FROM_NAV: Record<string, { name: string; widthCm: number; lengthCm: number; factor: number }> = {
  "face-cloths": { name: "Face cloth", widthCm: 30, lengthCm: 30, factor: 0.25 },
  "hand-towels": { name: "Hand towel", widthCm: 50, lengthCm: 90, factor: 7 / 12 },
  "bath-towels": { name: "Bath towel", widthCm: 70, lengthCm: 130, factor: 1 },
  "bath-sheets": { name: "Bath sheet", widthCm: 100, lengthCm: 150, factor: 1.5 },
};

/** Size chips beyond the towel sizes in the menu: robes, sets and "One size" (grouped like the shop filter). */
const ROBE_SIZES = ["XS", "S", "M", "L", "XL"];
const SET_SIZES = ["4-piece", "6-piece", "8-piece"];
const ONE_SIZE = "One size";
const SIZE_ORDER = [...Object.values(SIZE_FROM_NAV).map((x) => x.name), ...ROBE_SIZES, ...SET_SIZES, ONE_SIZE];

const CATEGORY_OPTIONS = navGroup("Shop by category").filter((l) => CATEGORY_TYPE[slugOf(l.href)]);
const COLLECTION_OPTIONS = navGroup("Shop by collection");
const SIZE_OPTIONS = navGroup("Shop by size").filter((l) => SIZE_FROM_NAV[slugOf(l.href)]);

const FEELS: Feel[] = ["Light & airy", "Soft & cosy", "Plush & indulgent", "Crisp & structured", "Smooth & sleek"];
const BADGES: (ProductBadge | "")[] = ["", "NEW IN", "New Colour", "Bestseller"];
const FAMILIES: ColorFamily[] = ["White", "Neutral", "Grey", "Black", "Green", "Blue", "Pink", "Red"];
const CARE: CareKind[] = ["wash", "bleach", "dry", "iron", "dryclean"];
const STOCK_STATUS: StockStatus[] = ["auto", "in", "low", "out"];
const DESIGNS: ProductRecord["design"][] = ["Plain", "Textured", "Patterned"];

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

const DEFAULT_CARE: { kind: CareKind; en: string }[] = [
  { kind: "wash", en: "Machine wash at 40°C with similar colours. Skip fabric softener so loops stay absorbent." },
  { kind: "bleach", en: "Do not bleach." },
  { kind: "dry", en: "Tumble dry on low, or line dry and shake out for extra fluff." },
  { kind: "iron", en: "Do not iron — it flattens the loops." },
];

export function blankProduct(collection?: string | null): ProductRecord {
  const type = CATEGORY_TYPE[collection ?? ""] ?? "Bath Towels";
  return {
    id: `u${Date.now().toString(36)}`,
    slug: "",
    sku: "",
    title: { en: "" },
    tagline: { en: "" },
    productType: type,
    feel: "Soft & cosy",
    material: suggestText("Organic cotton", materialDict),
    weightGsm: 600,
    design: "Plain",
    brand: siteConfig.name,
    categorySlug: "towels",
    collections: COLLECTION_OPTIONS.some((l) => slugOf(l.href) === collection) ? [collection as string] : [],
    description: { en: "" },
    highlights: { en: [] },
    specs: [],
    features: { en: [] },
    sizes: [{ name: "Bath towel", labels: suggestName("Bath towel", sizeDict), widthCm: 70, lengthCm: 130, price: 0, stock: { Chalk: 0 } }],
    careInstructions: DEFAULT_CARE.map((c) => ({ kind: c.kind, text: suggestText(c.en, careDict) })),
    reviews: [],
    images: [],
    price: 0,
    rating: 0,
    reviewCount: 0,
    stock: 0,
    stockStatus: "auto",
    fastDelivery: true,
    variants: { colors: [{ name: "Chalk", labels: suggestName("Chalk", colourDict), hex: "#f1ede4", family: "White", image: "" }] },
    sellerId: "s7",
    tags: ["new"],
    badge: "NEW IN",
    createdAt: new Date().toISOString(),
  };
}

/* ------------------------------ per-language helpers ------------------------------ */

const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
/** Trim; empty Turkish/Turkmen → undefined (falls back to English in the store). */
const cleanL10n = (v: L10n): L10n => {
  const out: L10n = { en: v.en.trim() };
  for (const l of EXTRA) out[l] = clean(v[l]);
  return out;
};
const cleanOptL10n = (v?: L10n): L10n | undefined => (v && (v.en.trim() || v.tr?.trim() || v.tk?.trim()) ? cleanL10n(v) : undefined);
const cleanList = (l?: string[]) => (l ?? []).map((x) => x.trim()).filter(Boolean);
const cleanL10nList = (v: L10nList): L10nList => {
  const out: L10nList = { en: cleanList(v.en) };
  for (const l of EXTRA) {
    const lines = cleanList(v[l]);
    out[l] = lines.length ? lines : undefined;
  }
  return out;
};
const cleanNames = (v?: NameL10n): NameL10n | undefined => {
  if (!v || !EXTRA.some((l) => clean(v[l]))) return undefined;
  const out: NameL10n = {};
  for (const l of EXTRA) out[l] = clean(v[l]);
  return out;
};


const isPhoto = (src?: string) => !!src && !src.startsWith("data:");

/**
 * Colours used to pick one of the product photos as their image. They now have their own
 * photos: a colour that pointed at a product photo (other than the main one, which belongs to
 * the general gallery) starts with that photo as its own, so nothing changes until it's edited.
 */
function withOwnColourPhotos(p: ProductRecord): ProductRecord {
  const colors = p.variants.colors;
  if (!colors?.length) return p;
  const main = p.images[0]?.src;
  return {
    ...p,
    variants: {
      ...p.variants,
      colors: colors.map((c) =>
        c.images?.length || !isPhoto(c.image) || c.image === main ? c : { ...c, images: [{ src: c.image, alt: "", blurDataURL: c.imageBlur }] },
      ),
    },
  };
}

/** A colour's own photos; the first one is also its swatch photo. Without own photos it keeps an older single image. */
function colourPhotos(c: ColorRecord): Pick<ColorRecord, "image" | "imageBlur" | "images"> {
  const own = (c.images ?? []).filter((i) => isPhoto(i.src));
  if (own.length) return { images: own, image: own[0].src, imageBlur: own[0].blurDataURL };
  return { images: undefined, image: isPhoto(c.image) ? c.image : "", imageBlur: isPhoto(c.image) ? c.imageBlur : undefined };
}

/** What gets sent to the server (the server also derives price, stock and tags). */
function toPayload(d: ProductRecord): ProductRecord {
  const colourKeys = d.variants.colors?.length ? d.variants.colors.map((c) => c.name) : ["default"];
  const sizes: SizeRecord[] = d.sizes.map((s) => ({
    ...s,
    labels: cleanNames(s.labels),
    note: cleanOptL10n(s.note),
    salePrice: s.salePrice || undefined,
    stock: Object.fromEntries(colourKeys.map((k) => [k, Math.max(0, Math.floor(Number(s.stock[k]) || 0))])),
  }));
  const prices = sizes.map(sizePrice);
  const cheapest = prices.reduce((a, b) => (b.price < a.price ? b : a), prices[0] ?? { price: 0, listPrice: undefined });
  return {
    ...d,
    title: cleanL10n(d.title),
    tagline: cleanL10n(d.tagline),
    description: cleanL10n(d.description),
    material: cleanL10n(d.material),
    weave: cleanOptL10n(d.weave),
    origin: cleanOptL10n(d.origin),
    slug: d.slug.trim(),
    sku: (d.sku ?? "").trim(),
    sizes,
    price: cheapest.price,
    listPrice: cheapest.listPrice,
    stock: sizes.reduce((n, s) => n + Object.values(s.stock).reduce((a, b) => a + b, 0), 0),
    features: cleanL10nList(d.features),
    highlights: cleanL10nList(d.highlights),
    careInstructions: d.careInstructions.filter((c) => c.text.en.trim()).map((c) => ({ kind: c.kind, text: cleanL10n(c.text) })),
    // Generated illustrations (data: URLs) are never saved — only real uploads.
    variants: {
      ...d.variants,
      colors: d.variants.colors?.map((c) => ({
        ...c,
        name: c.name.trim(),
        labels: cleanNames(c.labels),
        ...colourPhotos(c),
      })),
    },
    images: d.images.filter((i) => isPhoto(i.src)),
  };
}

/* ------------------------------ small UI pieces ------------------------------ */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-navy/10 bg-surface p-4 sm:p-6">
      <h2 className="text-base font-medium">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger" role="alert">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

const errProps = (id: string, error?: string) =>
  error ? { "aria-invalid": true, "aria-describedby": `${id}-error`, className: "border-danger" } : {};

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50",
        on ? "border-navy bg-navy text-cream" : "border-navy/20 hover:border-navy",
      )}
    >
      {children}
    </button>
  );
}

const AMBER = "#d97706";
/** Thin amber left border on a translatable field that's still empty in the current language */
const emptyMark = (empty: boolean) => (empty ? "border-l-2 !border-l-[#d97706]" : "");

/** A text field stored in every language; shows the active language and English as a gray placeholder. */
function L10nField({
  label,
  id,
  value,
  onChange,
  lang,
  multiline,
  rows = 4,
  error,
  hint,
  placeholder,
  maxLength,
  required,
}: {
  label: string;
  id: string;
  value: L10n | undefined;
  onChange: (v: L10n) => void;
  lang: Lang;
  multiline?: boolean;
  rows?: number;
  error?: string;
  hint?: React.ReactNode;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  const v = value ?? { en: "" };
  const current = (lang === "en" ? v.en : v[lang]) ?? "";
  const t = useT("admin");
  // Empty translated field: the English text shows in gray as a reference
  const ph = lang === "en" ? placeholder : v.en || t("fields.emptyText", { language: langName(lang) });
  const empty = lang !== "en" && !!v.en.trim() && !current.trim();
  // Errors are about the English text (required); in another language say where to fix it
  const showError = error && (lang === "en" ? error : t("status.fixInEnglish", { error }));
  const set = (text: string) => onChange({ ...v, [lang]: text });
  const common = {
    id,
    value: current,
    placeholder: ph,
    maxLength,
    lang,
    "data-l10n": "",
    "data-empty": empty || undefined,
    onChange: (ev: { target: { value: string } }) => set(ev.target.value),
    ...errProps(id, showError),
    className: cn(errProps(id, showError).className, emptyMark(empty)),
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && lang === "en" && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </Label>
      {multiline ? <Textarea rows={rows} {...common} /> : <Input {...common} />}
      {showError ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">{showError}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Size names that need no translation (letters, "One size") */
const needsLabel = (name: string) => name !== "One size" && !/^(XS|S|M|L|XL|XXL)$/.test(name);

/**
 * Translatable inputs that are empty in `lang` while English has text, as element ids in
 * page order — used for the switcher dots, the "3 Turkish fields are empty" count and
 * the jump to the first one.
 */
function emptyFieldIds(d: ProductRecord, lang: Lang, f: (name: string) => string): string[] {
  if (lang === "en") return [];
  const out: string[] = [];
  const text = (id: string, v?: L10n) => v?.en.trim() && !v[lang]?.trim() && out.push(f(id));
  text("title", d.title);
  text("tagline", d.tagline);
  text("desc", d.description);
  d.sizes.forEach((s, i) => needsLabel(s.name) && !s.labels?.[lang]?.trim() && out.push(f(`sl${i}`)));
  (d.variants.colors ?? []).forEach((c, i) => c.name.trim() && !c.labels?.[lang]?.trim() && out.push(f(`c${i}l`)));
  text("mat", d.material);
  text("weave", d.weave);
  text("origin", d.origin);
  if (d.features.en.some((x) => x.trim()) && !d.features[lang]?.some((x) => x.trim())) out.push(f("feat"));
  d.careInstructions.forEach((c, i) => text(`care${i}`, c.text));
  return out;
}

const iconBtn = "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";

/* ------------------------------ the form ------------------------------ */

export function AdminProductForm({ product, collection, returnTo }: { product?: ProductRecord; collection?: string | null; returnTo: string }) {
  const id = useId();
  const navigate = useNavigate();
  const editing = !!product;
  const [initial] = useState<ProductRecord>(() => (product ? withOwnColourPhotos(product) : blankProduct(collection)));
  const [d, setD] = useState<ProductRecord>(initial);
  // One language for the whole admin: interface, the product text being edited and the preview
  // (the admin's language — cookie admin_locale; the switcher sits in the status bar below)
  const lang = useAdminLocale((s) => s.locale);
  const t = useT("admin");
  const tf = useT("admin.fields");
  const tp = useT();
  const navText = useNavText();
  const reduceMotion = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<null | "save" | "another">(null);
  const [confirmDelete, setConfirmDelete] = useState<Deletable[] | null>(null);
  const allowLeave = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const f = (name: string) => `${id}-${name}`;
  // Errors are kept in English (as validation/the server send them) and shown in the admin language
  const e = (path: string) => (errors[path] ? adminError(errors[path]) : undefined);
  const set = <K extends keyof ProductRecord>(key: K, value: ProductRecord[K]) => setD((x) => ({ ...x, [key]: value }));
  const colors = d.variants.colors ?? [];
  const colourKeys = colors.length ? colors.map((c) => c.name) : ["default"];
  /** Shorthand for a translatable field */
  const lf = { lang };

  // Alt+1…Alt+4 are handled for every admin page in AdminI18n

  // Fade the translatable values in when the language changes (no layout change, no scroll)
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) {
      firstLang.current = false;
      return;
    }
    if (reduceMotion || !formRef.current) return;
    const els = formRef.current.querySelectorAll<HTMLElement>("[data-l10n], [data-l10n-preview]");
    if (els.length) animate(els, { opacity: [0.35, 1] }, { duration: 0.15, ease: "easeOut" });
  }, [lang, reduceMotion]);

  // Shadow under the language bar only while it's stuck below the header
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!sentinel || !bar || typeof IntersectionObserver === "undefined") return;
    const top = parseFloat(getComputedStyle(bar).top) || 0;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top + 1), {
      rootMargin: `-${top + 1}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  /* ---- unsaved changes ---- */
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(initial), [d, initial]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(translate("admin.actions.leaveConfirm"))) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---- translation status (top bar dots, save warning) ---- */
  const missing = useMemo(() => missingTranslations(toPayload(d)), [d]);

  /* ---- sizes ---- */
  const sizeNames = d.sizes.map((s) => s.name);
  const extraSizes = sizeNames.filter((n) => !SIZE_ORDER.includes(n));
  const sortSizes = (list: SizeRecord[]) =>
    [...list].sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a.name);
      const ib = SIZE_ORDER.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  /** Robe sizes, sets and "One size": same price/stock shape as the first size; "One size" replaces the rest. */
  const toggleNamedSize = (name: string) => {
    if (sizeNames.includes(name)) {
      if (d.sizes.length === 1) return;
      set("sizes", d.sizes.filter((s) => s.name !== name));
      return;
    }
    const first = d.sizes[0];
    const next: SizeRecord = {
      name,
      labels: suggestName(name, sizeDict),
      price: first?.price ?? 0,
      salePrice: first?.salePrice,
      stock: Object.fromEntries(colourKeys.map((k) => [k, name === ONE_SIZE ? (first?.stock[k] ?? 0) : 0])),
    };
    if (name === ONE_SIZE) return set("sizes", [next]);
    const keep = d.sizes.length === 1 && d.sizes[0].name === ONE_SIZE ? [] : d.sizes;
    set("sizes", sortSizes([...keep, next]));
  };
  const toggleSize = (key: string) => {
    const spec = SIZE_FROM_NAV[key];
    if (sizeNames.includes(spec.name)) {
      if (d.sizes.length === 1) return;
      set("sizes", d.sizes.filter((s) => s.name !== spec.name));
      return;
    }
    // Suggest a price from an existing standard size (Bath towel = 1×)
    const ref = d.sizes.find((s) => Object.values(SIZE_FROM_NAV).some((x) => x.name === s.name)) ?? d.sizes[0];
    const refFactor = Object.values(SIZE_FROM_NAV).find((x) => x.name === ref?.name)?.factor ?? 1;
    const price = ref?.price ? round2(Math.round((ref.price / refFactor) * spec.factor)) : 0;
    const replacingOneSize = d.sizes.length === 1 && d.sizes[0].name === "One size";
    const next: SizeRecord = {
      name: spec.name,
      labels: suggestName(spec.name, sizeDict),
      widthCm: spec.widthCm,
      lengthCm: spec.lengthCm,
      price,
      stock: Object.fromEntries(colourKeys.map((k) => [k, 0])),
    };
    set("sizes", sortSizes([...(replacingOneSize ? [] : d.sizes), next]));
  };
  const updateSize = (i: number, patch: Partial<SizeRecord>) => set("sizes", d.sizes.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const setStock = (sizeIndex: number, colour: string, value: string) =>
    updateSize(sizeIndex, { stock: { ...d.sizes[sizeIndex].stock, [colour]: Math.max(0, Math.floor(Number(value) || 0)) } });
  const sizeName = (s: SizeRecord) => (lang !== "en" && s.labels?.[lang]) || s.name;

  /* ---- colours ---- */
  const setColors = (list: ColorRecord[], renameFrom?: string, renameTo?: string, removed?: string) =>
    setD((x) => ({
      ...x,
      variants: { ...x.variants, colors: list.length ? list : undefined },
      sizes: x.sizes.map((s) => {
        const stock = { ...s.stock };
        if (renameFrom !== undefined && renameTo !== undefined) {
          stock[renameTo] = stock[renameFrom] ?? 0;
          delete stock[renameFrom];
        }
        if (removed !== undefined) delete stock[removed];
        if (!list.length) return { ...s, stock: { default: Object.values(stock).reduce((a, b) => a + b, 0) } };
        delete stock.default;
        for (const c of list) stock[c.name] ??= 0;
        return { ...s, stock };
      }),
    }));
  const updateColor = (i: number, patch: Partial<ColorRecord>) => {
    const old = colors[i];
    const renamed = patch.name !== undefined && patch.name !== old.name;
    // A known English colour name pre-fills empty translations ("Sand" → Kum / Gum)
    if (renamed) {
      const hint = suggestName(patch.name!, colourDict);
      if (hint) patch = { ...patch, labels: mergeEmpty(old.labels, hint) };
    }
    setColors(
      colors.map((c, n) => (n === i ? { ...c, ...patch } : c)),
      renamed ? old.name : undefined,
      renamed ? patch.name : undefined,
    );
  };
  const addColor = () => {
    let n = colors.length + 1;
    // New colours get an English placeholder name (the English name is the colour's key)
    while (colors.some((c) => c.name === `Colour ${n}`)) n++;
    setColors([...colors, { name: `Colour ${n}`, hex: "#c8b18e", family: "Neutral", image: "" }]);
  };
  const moveColor = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= colors.length) return;
    const list = [...colors];
    [list[i], list[j]] = [list[j], list[i]];
    setColors(list);
  };
  const colourName = (c: ColorRecord) => (lang !== "en" && c.labels?.[lang]) || c.name;

  /** English material/weave/origin typed → fill empty translations from the term list. */
  const withSuggestion = (v: L10n, dict: Record<string, Record<TranslatedLocale, string>>): L10n => {
    if (lang !== "en") return v;
    const hint = suggestText(v.en, dict);
    return { en: v.en, ...mergeEmpty(v, hint) };
  };

  /* ---- preview ---- */
  const preview = useMemo(() => {
    const p = toPayload(d);
    const record = withArtwork({
      ...p,
      title: p.title.en ? p.title : { en: t("preview.placeholderName") },
      tagline: p.tagline.en ? p.tagline : { en: t("preview.placeholderTagline") },
    });
    return localizeProduct(record, lang);
  }, [d, lang, t]);

  /* ---- save ---- */
  const validate = (payload: ProductRecord) => {
    const parsed = productSchema.safeParse(payload);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    const others = listRecords({ includeHidden: true }).filter((p) => p.id !== payload.id);
    if (payload.slug && others.some((p) => p.slug === payload.slug)) errs.slug ??= "This slug is already used by another product";
    if (payload.sku && others.some((p) => p.sku?.toLowerCase() === payload.sku?.toLowerCase())) errs.sku ??= "This SKU is already used by another product";
    // Error paths of per-language fields end in ".en" → show them on the field
    for (const key of Object.keys(errs)) if (key.endsWith(".en")) errs[key.slice(0, -3)] ??= errs[key];
    return errs;
  };

  const focusFirstError = () =>
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [role='alert']");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el && "focus" in el) el.focus({ preventScroll: true });
    });

  const save = async (mode: "save" | "another") => {
    const payload = toPayload(d);
    const errs = validate(payload);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(t("toasts.fixFields"), { description: errs["title"] ? t("toasts.nameRequired") : undefined });
      focusFirstError();
      return;
    }
    setSaving(mode);
    try {
      const saved = editing ? await adminApi.update(payload) : await adminApi.create(payload);
      await refreshCatalog("admin");
      allowLeave.current = true;
      const savedName = (lang !== "en" && saved.title[lang]) || saved.title.en;
      toast.success(editing ? t("toasts.saved") : t("toasts.added"), { description: saved.hidden ? t("toasts.hiddenSuffix", { name: savedName }) : savedName });
      // Saved anyway, but say which languages will fall back to English
      const gaps = missingTranslations(payload);
      for (const l of EXTRA)
        if (gaps[l].length)
          toast.warning(t("toasts.missingTranslation", { language: langName(l) }), {
            description: t("toasts.missingDetail", { fields: gaps[l].map((g) => t(`fieldNames.${g}`)).join(", ") }),
          });
      if (mode === "another") navigate(`${ADMIN_BASE}/products/new${collection ? `?collection=${collection}` : ""}`, { replace: !editing });
      else navigate(returnTo);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        const fields = { ...err.fields };
        for (const key of Object.keys(fields)) if (key.endsWith(".en")) fields[key.slice(0, -3)] ??= fields[key];
        setErrors(fields);
        focusFirstError();
      }
      toast.error(err instanceof ApiError ? adminError(err.message) : t("toasts.saveFailed"));
    } finally {
      setSaving(null);
    }
  };

  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    void save("save");
  };

  /* ------------------------------ render ------------------------------ */

  const currentCategory = Object.entries(CATEGORY_TYPE).find(([, t]) => t === d.productType)?.[0];
  const emptyByLang = Object.fromEntries(locales.map((l) => [l, emptyFieldIds(d, l, f).length])) as Record<Lang, number>;
  const emptyHere = emptyFieldIds(d, lang, f);
  const emptyIds = new Set(emptyHere);
  const isEmpty = (name: string) => emptyIds.has(f(name));
  const goToFirstEmpty = () => {
    const el = emptyHere[0] ? document.getElementById(emptyHere[0]) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
      <div className="min-w-0 space-y-6">
        {/* ---------------- Language (the only language control on the page) ---------------- */}
        <div ref={sentinelRef} aria-hidden="true" className="h-0" />
        <div
          ref={barRef}
          className={cn(
            "sticky top-[var(--toolbar-top)] z-20 !mt-0 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-navy/10 bg-surface/95 px-4 py-3 backdrop-blur transition-shadow duration-200",
            stuck && "shadow-[0_6px_12px_-8px_rgba(43,59,99,0.35)]",
          )}
        >
          <div className="min-w-0 text-sm">
            <p className="font-medium" aria-live="polite">
              {t("status.editing", { language: langName(lang) })}
            </p>
            <p className="text-xs text-muted-foreground">
              {lang === "en" ? (
                t("status.enRequired")
              ) : emptyHere.length ? (
                <button type="button" onClick={goToFirstEmpty} className="text-left underline decoration-dotted underline-offset-2 hover:text-foreground" style={{ color: AMBER }}>
                  {t("status.emptyCount", { count: emptyHere.length })}
                </button>
              ) : (
                t("status.allFilled")
              )}
            </p>
          </div>
          <AdminLanguageSwitcher missing={emptyByLang} />
        </div>

        {/* ---------------- Basics ---------------- */}
        <Section title={t("sections.basics")}>
          <L10nField
            {...lf}
            label={tf("name")}
            id={f("title")}
            required
            value={d.title}
            onChange={(title) => setD((x) => ({ ...x, title, slug: slugTouched || lang !== "en" ? x.slug : slugify(title.en) }))}
            placeholder={tf("namePlaceholder")}
            error={e("title")}
            maxLength={160}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tf("slug")} htmlFor={f("slug")} error={e("slug")} hint={tf("slugHint", { paths: `/{${locales.join(",")}}/products/${d.slug || "…"}` })}>
              <Input
                id={f("slug")}
                value={d.slug}
                onChange={(ev) => {
                  setSlugTouched(true);
                  set("slug", slugify(ev.target.value));
                }}
                {...errProps(f("slug"), e("slug"))}
              />
            </Field>
            <Field label={tf("sku")} htmlFor={f("sku")} error={e("sku")}>
              <Input id={f("sku")} value={d.sku ?? ""} onChange={(ev) => set("sku", ev.target.value.toUpperCase())} placeholder={tf("skuPlaceholder")} {...errProps(f("sku"), e("sku"))} />
            </Field>
          </div>
          <L10nField {...lf} label={tf("tagline")} id={f("tagline")} value={d.tagline} onChange={(v) => set("tagline", v)} maxLength={120} error={e("tagline")} hint={tf("taglineHint")} />
          <L10nField {...lf} label={tf("description")} id={f("desc")} multiline rows={6} value={d.description} onChange={(v) => set("description", v)} error={e("description")} />
        </Section>

        {/* ---------------- Organisation ---------------- */}
        <Section title={t("sections.organisation")} description={t("sections.organisationHint")}>
          <Field label={tf("category")} htmlFor={f("cat")} error={e("productType")}>
            <Select
              id={f("cat")}
              value={currentCategory ?? `type:${d.productType}`}
              onChange={(ev) => {
                const type = CATEGORY_TYPE[ev.target.value];
                if (type) setD((x) => ({ ...x, productType: type, categorySlug: "towels" }));
              }}
            >
              {!currentCategory && <option value={`type:${d.productType}`}>{tf("categoryCurrent", { type: tp.has(`productTypes.${d.productType}`) ? tp(`productTypes.${d.productType}`) : d.productType })}</option>}
              {CATEGORY_OPTIONS.map((l) => (
                <option key={l.href} value={slugOf(l.href)}>
                  {navText.link(l)}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">{tf("collection")}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={tf("collection")}>
              {COLLECTION_OPTIONS.map((l) => {
                const slug = slugOf(l.href);
                const on = !!d.collections?.includes(slug);
                return (
                  <Chip key={slug} on={on} onClick={() => set("collections", on ? (d.collections ?? []).filter((c) => c !== slug) : [...(d.collections ?? []), slug])}>
                    {l.icon && <NavIcon name={l.icon} size={16} />}
                    {navText.link(l)}
                  </Chip>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{tf("sizes")}</p>
            <div className="space-y-3" role="group" aria-label={tf("sizes")}>
              <div>
                <p className="eyebrow mb-1.5 text-muted-foreground">{tp("filters.sizeGroups.towel")}</p>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((l) => {
                    const key = slugOf(l.href);
                    const on = sizeNames.includes(SIZE_FROM_NAV[key].name);
                    return (
                      <Chip key={key} on={on} disabled={on && d.sizes.length === 1} onClick={() => toggleSize(key)}>
                        {l.icon && <NavIcon name={l.icon} size={16} />}
                        {navText.link(l)}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              {(
                [
                  ["robe", ROBE_SIZES],
                  ["sets", SET_SIZES],
                  ["other", [ONE_SIZE, ...extraSizes]],
                ] as const
              ).map(([group, names]) => (
                <div key={group}>
                  <p className="eyebrow mb-1.5 text-muted-foreground">{tp(`filters.sizeGroups.${group}`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {names.map((n) => {
                      const on = sizeNames.includes(n);
                      const own = d.sizes.find((s) => s.name === n);
                      return (
                        <Chip key={n} on={on} disabled={on && d.sizes.length === 1} onClick={() => toggleNamedSize(n)}>
                          {own ? sizeName(own) : tp.has(`sizes.${n}`) ? tp(`sizes.${n}`) : n}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {e("sizes") && <p className="mt-1.5 text-xs text-danger" role="alert">{e("sizes")}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!d.personalisable} onChange={(ev) => set("personalisable", ev.target.checked || undefined)} />
            {tf("personalisable")}
          </label>
        </Section>

        {/* ---------------- Price ---------------- */}
        <Section title={t("sections.price")} description={t("sections.priceHint")}>
          {d.sizes.map((s, i) => {
            const pct = discountPercent(s.salePrice ?? s.price, s.salePrice ? s.price : undefined);
            return (
              <div key={i} className={cn(d.sizes.length > 1 && "rounded-sm border border-navy/10 p-3")}>
                {d.sizes.length > 1 && <p className="mb-2 text-sm font-medium">{sizeName(s)}</p>}
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label={tf("price")} htmlFor={f(`p${i}`)} error={e(`sizes.${i}.price`)}>
                    <Input id={f(`p${i}`)} type="number" inputMode="decimal" min={0} step="0.01" value={s.price || ""} onChange={(ev) => updateSize(i, { price: Number(ev.target.value) || 0 })} {...errProps(f(`p${i}`), e(`sizes.${i}.price`))} />
                  </Field>
                  <Field
                    label={tf("salePrice")}
                    htmlFor={f(`sp${i}`)}
                    error={e(`sizes.${i}.salePrice`)}
                    hint={pct > 0 ? <span className="font-medium text-accent">{tf("discountBadge", { pct })}</span> : tf("optional")}
                  >
                    <Input id={f(`sp${i}`)} type="number" inputMode="decimal" min={0} step="0.01" value={s.salePrice ?? ""} onChange={(ev) => updateSize(i, { salePrice: num(ev.target.value) })} {...errProps(f(`sp${i}`), e(`sizes.${i}.salePrice`))} />
                  </Field>
                  <Field label={tf("width")} htmlFor={f(`w${i}`)}>
                    <Input id={f(`w${i}`)} type="number" min={0} value={s.widthCm ?? ""} onChange={(ev) => updateSize(i, { widthCm: num(ev.target.value) })} />
                  </Field>
                  <Field label={tf("length")} htmlFor={f(`l${i}`)}>
                    <Input id={f(`l${i}`)} type="number" min={0} value={s.lengthCm ?? ""} onChange={(ev) => updateSize(i, { lengthCm: num(ev.target.value) })} />
                  </Field>
                </div>
                {lang !== "en" && (
                  <Field label={tf("sizeName")} htmlFor={f(`sl${i}`)} className="mt-3" hint={isEmpty(`sl${i}`) ? tf("sizeNameEmpty") : undefined}>
                    <Input
                      id={f(`sl${i}`)}
                      lang={lang}
                      data-l10n=""
                      data-empty={isEmpty(`sl${i}`) || undefined}
                      className={emptyMark(isEmpty(`sl${i}`))}
                      value={s.labels?.[lang] ?? ""}
                      placeholder={s.name}
                      onChange={(ev) => updateSize(i, { labels: { ...s.labels, [lang]: ev.target.value } })}
                    />
                  </Field>
                )}
              </div>
            );
          })}
        </Section>

        {/* ---------------- Images ---------------- */}
        <Section title={t("sections.images")} description={t("sections.imagesHint")}>
          <ImageManager images={d.images} onChange={(images) => set("images", images)} slug={d.slug} title={d.title.en} error={e("images")} />
        </Section>

        {/* ---------------- Colours ---------------- */}
        <Section
          title={t("sections.colours")}
          description={`${d.sizes.length > 1 ? t("sections.coloursStockPerSize") : t("sections.coloursStock")} ${t("sections.coloursKey")}`}
        >
          <ul className="space-y-3">
            {colors.map((c, i) => {
              return (
                <li key={i} className="rounded-sm border border-navy/10 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col">
                      <button type="button" aria-label={tf("moveUp", { name: colourName(c) })} onClick={() => moveColor(i, -1)} disabled={i === 0} className={iconBtn}>
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" aria-label={tf("moveDown", { name: colourName(c) })} onClick={() => moveColor(i, 1)} disabled={i === colors.length - 1} className={iconBtn}>
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {lang === "en" ? (
                      <Field label={tf("colourName")} htmlFor={f(`c${i}n`)} error={e(`variants.colors.${i}.name`)} className="min-w-32 flex-1">
                        <Input id={f(`c${i}n`)} data-l10n="" value={c.name} onChange={(ev) => updateColor(i, { name: ev.target.value })} {...errProps(f(`c${i}n`), e(`variants.colors.${i}.name`))} />
                      </Field>
                    ) : (
                      <Field label={tf("colourName")} htmlFor={f(`c${i}l`)} className="min-w-32 flex-1">
                        <Input
                          id={f(`c${i}l`)}
                          lang={lang}
                          data-l10n=""
                          data-empty={isEmpty(`c${i}l`) || undefined}
                          className={emptyMark(isEmpty(`c${i}l`))}
                          value={c.labels?.[lang] ?? ""}
                          placeholder={c.name}
                          onChange={(ev) => updateColor(i, { labels: { ...c.labels, [lang]: ev.target.value } })}
                        />
                      </Field>
                    )}
                    <Field label={tf("colour")} htmlFor={f(`c${i}h`)} error={e(`variants.colors.${i}.hex`)}>
                      <div className="flex items-center gap-2">
                        <input id={f(`c${i}h`)} type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"} onChange={(ev) => updateColor(i, { hex: ev.target.value })} className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1" />
                        <Input aria-label={tf("hexValue", { name: colourName(c) })} value={c.hex} onChange={(ev) => updateColor(i, { hex: ev.target.value })} className="w-24 font-mono text-xs" />
                      </div>
                    </Field>
                    <Field label={tf("filterGroup")} htmlFor={f(`c${i}f`)}>
                      <Select id={f(`c${i}f`)} value={c.family} onChange={(ev) => updateColor(i, { family: ev.target.value as ColorFamily })} wrapperClassName="w-32">
                        {FAMILIES.map((x) => (
                          <option key={x} value={x}>{tp(`colourFamilies.${x}`)}</option>
                        ))}
                      </Select>
                    </Field>
                    <span className="relative mb-0.5 h-10 w-8 shrink-0 overflow-hidden rounded-xs border" style={{ background: c.hex }} aria-hidden="true">
                      {isPhoto(c.images?.[0]?.src) && <img src={c.images![0].src} alt="" className="absolute inset-0 size-full object-cover" />}
                    </span>
                    <button type="button" aria-label={tf("removeColour", { name: colourName(c) })} onClick={() => setColors(colors.filter((_, n) => n !== i), undefined, undefined, c.name)} className={cn(iconBtn, "mb-1 hover:text-danger")}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium">{tf("colourPhotos", { colour: colourName(c) })}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{tf("colourPhotosHint")}</p>
                    <ImageManager
                      images={c.images ?? []}
                      onChange={(images) => updateColor(i, { images })}
                      slug={d.slug}
                      title={d.title.en ? `${d.title.en} – ${c.name}` : ""}
                      error={e(`variants.colors.${i}.images`)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{d.sizes.length > 1 ? tf("stockBySize") : tf("stock")}</span>
                    {d.sizes.map((s, si) => (
                      <label key={s.name} className="flex items-center gap-1.5 rounded-xs border border-navy/15 px-2 py-1 text-xs">
                        {d.sizes.length > 1 && <span>{sizeName(s)}</span>}
                        <input
                          type="number"
                          min={0}
                          value={s.stock[c.name] ?? 0}
                          onChange={(ev) => setStock(si, c.name, ev.target.value)}
                          aria-label={tf("stockFor", { colour: colourName(c), size: sizeName(s) })}
                          className="w-16 rounded-xs border bg-transparent px-1 py-0.5 text-right tabular-nums"
                        />
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {!colors.length && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>{tf("stockQuantity")}</span>
              {d.sizes.map((s, si) => (
                <label key={s.name} className="flex items-center gap-1.5 rounded-xs border border-navy/15 px-2 py-1 text-xs">
                  {d.sizes.length > 1 && <span>{sizeName(s)}</span>}
                  <input type="number" min={0} value={s.stock.default ?? 0} onChange={(ev) => setStock(si, "default", ev.target.value)} aria-label={tf("stockForSize", { size: sizeName(s) })} className="w-16 rounded-xs border bg-transparent px-1 py-0.5 text-right" />
                </label>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addColor}>
            <Plus aria-hidden="true" /> {tf("addColour")}
          </Button>
        </Section>

        {/* ---------------- Details ---------------- */}
        <Section title={t("sections.material")} description={t("sections.materialHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <L10nField {...lf} label={tf("material")} id={f("mat")} required value={d.material} onChange={(v) => set("material", withSuggestion(v, materialDict))} error={e("material")} maxLength={80} />
            <L10nField {...lf} label={tf("weave")} id={f("weave")} value={d.weave} onChange={(v) => set("weave", withSuggestion(v, weaveDict))} placeholder={tf("weavePlaceholder")} maxLength={80} />
            <L10nField {...lf} label={tf("origin")} id={f("origin")} value={d.origin} onChange={(v) => set("origin", withSuggestion(v, originDict))} placeholder={tf("originPlaceholder")} maxLength={120} />
            <Field label={tf("weight")} htmlFor={f("gsm")} error={e("weightGsm")}>
              <Input id={f("gsm")} type="number" min={0} value={d.weightGsm ?? ""} onChange={(ev) => set("weightGsm", num(ev.target.value))} />
            </Field>
            <Field label={tf("feel")} htmlFor={f("feel")}>
              <Select id={f("feel")} value={d.feel} onChange={(ev) => set("feel", ev.target.value as Feel)}>
                {FEELS.map((x) => (
                  <option key={x} value={x}>{tp(`feels.${x}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={tf("design")} htmlFor={f("design")}>
              <Select id={f("design")} value={d.design} onChange={(ev) => set("design", ev.target.value as ProductRecord["design"])}>
                {DESIGNS.map((x) => (
                  <option key={x} value={x}>{tp(`designs.${x}`)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={f("feat")}>{tf("features")}</Label>
            <Textarea
              id={f("feat")}
              lang={lang}
              data-l10n=""
              data-empty={isEmpty("feat") || undefined}
              className={emptyMark(isEmpty("feat"))}
              rows={4}
              value={(d.features[lang] ?? []).join("\n")}
              placeholder={lang === "en" ? undefined : d.features.en.join("\n")}
              onChange={(ev) => set("features", { ...d.features, [lang]: ev.target.value.split("\n") })}
            />
            <p className="text-xs text-muted-foreground">
              {lang === "en" ? tf("featuresHint") : tf("featuresHintTranslated")}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{tf("careGuide")}</p>
            <ul className="space-y-2">
              {d.careInstructions.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <Select aria-label={tf("careType")} value={c.kind} onChange={(ev) => set("careInstructions", d.careInstructions.map((x, n) => (n === i ? { ...x, kind: ev.target.value as CareKind } : x)))} wrapperClassName="w-36">
                    {CARE.map((k) => (
                      <option key={k} value={k}>{t(`careKinds.${k}`)}</option>
                    ))}
                  </Select>
                  <Input
                    id={f(`care${i}`)}
                    aria-label={tf("careInstruction")}
                    lang={lang}
                    data-l10n=""
                    data-empty={isEmpty(`care${i}`) || undefined}
                    value={c.text[lang] ?? ""}
                    placeholder={lang === "en" ? undefined : c.text.en}
                    onChange={(ev) =>
                      set(
                        "careInstructions",
                        d.careInstructions.map((x, n) => {
                          if (n !== i) return x;
                          const text = { ...x.text, [lang]: ev.target.value };
                          return { ...x, text: lang === "en" ? { ...text, ...mergeEmpty(x.text, careDict[text.en.trim()] ?? {}) } : text };
                        }),
                      )
                    }
                    className={cn("min-w-48 flex-1", emptyMark(isEmpty(`care${i}`)))}
                  />
                  <button type="button" aria-label={tf("removeCare")} onClick={() => set("careInstructions", d.careInstructions.filter((_, n) => n !== i))} className={cn(iconBtn, "hover:text-danger")}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => set("careInstructions", [...d.careInstructions, { kind: "wash", text: { en: "" } }])}>
              <Plus aria-hidden="true" /> {tf("addCare")}
            </Button>
          </div>
        </Section>

        {/* ---------------- Status ---------------- */}
        <Section title={t("sections.status")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tf("badge")} htmlFor={f("badge")} hint={tf("badgeHint")}>
              <Select id={f("badge")} value={d.badge ?? ""} onChange={(ev) => set("badge", (ev.target.value || undefined) as ProductBadge | undefined)}>
                {BADGES.map((b) => (
                  <option key={b || "none"} value={b}>{b ? tp(`badges.${b}`) : tf("badgeNone")}</option>
                ))}
              </Select>
            </Field>
            <Field label={tf("stockStatus")} htmlFor={f("stock")} hint={tf("stockStatusHint")}>
              <Select id={f("stock")} value={d.stockStatus ?? "auto"} onChange={(ev) => set("stockStatus", ev.target.value as StockStatus)}>
                {STOCK_STATUS.map((s) => (
                  <option key={s} value={s}>{t(`stockStatus.${s}`)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-sm border border-navy/10 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">{tf("visible")}</span>
              <span className="block text-xs text-muted-foreground">{tf("visibleHint")}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={!d.hidden}
              onChange={(ev) => set("hidden", ev.target.checked ? undefined : true)}
              className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-navy/20 transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-navy checked:before:translate-x-5"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={d.fastDelivery} onChange={(ev) => set("fastDelivery", ev.target.checked)} /> {tf("fastDelivery")}
          </label>
        </Section>

        {editing && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setConfirmDelete([{ id: product!.id, title: (lang !== "en" && product!.title[lang]) || product!.title.en, images: product!.images }])}>
              <Trash2 aria-hidden="true" /> {t("actions.deleteProduct")}
            </Button>
          </div>
        )}
      </div>

      {/* ---------------- Preview + actions ---------------- */}
      <aside className="space-y-4 lg:sticky lg:top-[120px] lg:self-start">
        <section className="rounded-sm border border-navy/10 bg-surface p-4" aria-label={t("sections.preview")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="eyebrow text-muted-foreground">{t("sections.preview")}</p>
          </div>
          <div className="pointer-events-none select-none" aria-hidden="true" data-l10n-preview="">
            <I18nProvider locale={lang} prefix={false} scoped>
              <AdminCardProvider value={null}>
                <ProductCard key={`${lang}|${colors.map((c) => c.name).join("|")}`} product={preview} sizes="320px" />
              </AdminCardProvider>
            </I18nProvider>
          </div>
          {lang !== "en" && missing[lang].length > 0 && (
            <p className="mt-3 rounded-xs bg-accent-soft px-2 py-1 text-xs text-accent">
              {t("preview.notTranslated", { fields: missing[lang].map((g) => t(`fieldNames.${g}`)).join(", ") })}
            </p>
          )}
          {d.hidden && <p className="mt-3 rounded-xs bg-muted px-2 py-1 text-xs text-muted-foreground">{t("preview.hidden")}</p>}
        </section>
        <div className="space-y-2 rounded-sm border border-navy/10 bg-surface p-4">
          <Button type="submit" className="w-full" disabled={!!saving}>
            {saving === "save" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {t("actions.save")}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!!saving} onClick={() => void save("another")}>
            {saving === "another" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {t("actions.saveAnother")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={!!saving} onClick={() => navigate(returnTo)}>
            {t("actions.cancel")}
          </Button>
          {dirty && <p className="text-center text-xs text-muted-foreground">{t("actions.unsaved")}</p>}
        </div>
      </aside>

      <DeleteDialog
        products={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        onDeleted={() => {
          allowLeave.current = true;
          navigate(returnTo);
        }}
      />
    </form>
  );
}
