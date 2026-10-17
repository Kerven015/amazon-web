import { ArrowLeft, CreditCard, LoaderCircle, Lock, Pencil, Plus, ShoppingBag, Truck, Wallet, Zap } from "lucide-react";
import { Link } from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useId, useState } from "react";
import { OrderSummary } from "@/components/cart/order-summary";
import { TextShimmer } from "@/components/motion-ui/text-shimmer";
import { TransitionPanel } from "@/components/motion-ui/transition-panel";
import { variantLabel } from "@/components/product/use-add-to-cart";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Radio, Select } from "@/components/ui/input";
import { useStoreHydrated } from "@/lib/hooks/use-store-hydrated";
import { type AddressField, emptyAddress, useAddressBook, validateAddress } from "@/lib/store/addresses";
import { computeTotals, selectCount, selectDiscount, selectSubtotal, useCart } from "@/lib/store/cart";
import { cn, formatPrice } from "@/lib/utils";
import type { Address } from "@/types";
import { AccountApiError, accountApi, accountErrorMessage, type OutOfStockLine } from "@/lib/account-api";
import { loginHref } from "@/lib/session";
import { StepIndicator } from "./step-indicator";
import { ProductImage } from "@/components/product/product-image";
import { formatPrice as fmt, useLocale, useT } from "@/i18n";
import { getProductById } from "@/lib/catalog";
import { addressLabel, addressLine, countryName, deliveryLabel, paymentLabel } from "@/lib/order-format";
import { siteConfig } from "@/lib/config";
import { type DeliveryId, deliveryDetail, deliveryName, deliveryOptions, deliveryPrice } from "@/lib/delivery";
import { productHref } from "@/lib/product-utils";

/** Labels: messages → checkout.delivery.{id}; speeds and prices: siteConfig.deliveryOptions */
const deliveryIcons = { fast: Zap, standard: Truck, eco: ShoppingBag } as const;

const paymentOptions = [
  { id: "card", icon: CreditCard },
  { id: "wallet", icon: Wallet },
] as const;

type PaymentId = (typeof paymentOptions)[number]["id"];
type Card = { name: string; number: string; expiry: string; cvc: string };
type CardField = keyof Card;

/** Card checks only (demo — nothing is charged or stored). Returns field → message key (checkout.errors.*). */
export function validateCard(c: Card, now = new Date()): Partial<Record<CardField, string>> {
  const errors: Partial<Record<CardField, string>> = {};
  if (!c.name.trim()) errors.name = "required";
  const digits = c.number.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) errors.number = "cardNumber";
  const m = c.expiry.trim().match(/^(\d{2})\s*\/\s*(\d{2})$/);
  const month = m ? Number(m[1]) : 0;
  // Valid through the last day of the expiry month
  if (!m || month < 1 || month > 12 || new Date(2000 + Number(m[2]), month, 1) <= now) errors.expiry = "expiry";
  if (!/^\d{3,4}$/.test(c.cvc.trim())) errors.cvc = "cvc";
  return errors;
}

/** "4242424242424242" → "4242 4242 4242 4242" while typing */
const groupDigits = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

/** "1229" → "12/29" while typing */
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function Field({
  label,
  id,
  className,
  error,
  ...props
}: { label: string; id: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border bg-surface p-5 sm:p-8">
      <h2 className="mb-6 text-3xl [overflow-wrap:anywhere]">{title}</h2>
      {children}
    </section>
  );
}

/** Moves focus to the first field with an error (after React has rendered the messages). */
const focusFirstError = (root: string) =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-form="${root}"] [aria-invalid="true"]`)?.focus());

export function CheckoutFlow() {
  const router = useRouter();
  const t = useT("checkout");
  const locale = useLocale();
  const uid = useId();
  const STEPS = [t("steps.address"), t("steps.delivery"), t("steps.payment"), t("steps.review")];
  // Product names and variants in the current language
  const nameOf = (i: { productId: string; title: string }) => getProductById(i.productId, { includeHidden: true, locale })?.title ?? i.title;
  const hydrated = useStoreHydrated(useCart);
  const items = useCart((s) => s.items);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const discount = useCart(selectDiscount);
  const clear = useCart((s) => s.clear);
  const discountCode = useCart((s) => s.discountCode);
  const book = useAddressBook((s) => s.addresses);
  const saveAddress = useAddressBook((s) => s.add);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [addressId, setAddressId] = useState<string | null>(null);
  const chosenId = addressId ?? book.find((a) => a.isDefault)?.id ?? book[0]?.id ?? "new";
  const [draft, setDraft] = useState<Omit<Address, "id">>(() => emptyAddress(siteConfig.shippingCountries[0]));
  const [addressErrors, setAddressErrors] = useState<Partial<Record<AddressField, string>>>({});
  const [saveToBook, setSaveToBook] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryId>("standard");
  const [payment, setPayment] = useState<PaymentId>("card");
  const [card, setCard] = useState<Card>({ name: "", number: "", expiry: "", cvc: "" });
  const [cardErrors, setCardErrors] = useState<Partial<Record<CardField, string>>>({});
  const [placing, setPlacing] = useState(false);
  /** Why the server turned the order down (shown above "Place order") */
  const [orderError, setOrderError] = useState<{ code: string; lines: OutOfStockLine[] } | null>(null);

  const discounted = Math.max(0, subtotal - discount);
  const shippingFor = (id: DeliveryId) => deliveryPrice(id, discounted);
  const totals = computeTotals(subtotal, shippingFor(delivery), discount);
  /** The address the order goes to: a saved one, or what the shopper typed. */
  const address: Address | undefined = chosenId === "new" ? { ...draft, id: "new" } : book.find((a) => a.id === chosenId);
  const last4 = card.number.replace(/\D/g, "").slice(-4);
  const paymentCode = payment === "card" ? `card:Card:${last4 || "0000"}` : "wallet";

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setField = (f: keyof Omit<Address, "id">, v: string) => {
    setDraft((d) => ({ ...d, [f]: v }));
    // Clear a field's error as soon as it's fixed
    if (addressErrors[f as AddressField]) setAddressErrors((e) => ({ ...e, [f]: undefined }));
  };
  const setCardField = (f: CardField, v: string) => {
    setCard((c) => ({ ...c, [f]: v }));
    if (cardErrors[f]) setCardErrors((e) => ({ ...e, [f]: undefined }));
  };

  const continueFromAddress = () => {
    if (chosenId === "new") {
      const errs = validateAddress(draft);
      setAddressErrors(errs);
      if (Object.keys(errs).length) return focusFirstError("address");
    }
    go(1);
  };

  const continueFromPayment = () => {
    if (payment === "card") {
      const errs = validateCard(card);
      setCardErrors(errs);
      if (Object.keys(errs).length) return focusFirstError("card");
    }
    go(3);
  };

  /**
   * POST /api/orders. The server takes only what's in the bag (product, size, colour,
   * quantity) and works out every price, the discount, delivery and the total itself.
   * No card details are sent — only "card" + the last 4 digits for the receipt.
   */
  const placeOrder = async () => {
    if (!address) return go(0);
    setPlacing(true);
    setOrderError(null);
    try {
      let addressId: string | undefined = chosenId === "new" ? undefined : chosenId;
      const typed = { ...draft, line2: draft.line2?.trim() || undefined, label: draft.label || "" };
      if (chosenId === "new" && saveToBook) {
        addressId = (await saveAddress(typed, makeDefault)).id;
        setAddressId(addressId);
      }
      const order = await accountApi.placeOrder({
        items: items.map((i) => ({ productId: i.productId, size: i.variant.size, colour: i.variant.color, quantity: i.quantity })),
        ...(addressId ? { addressId } : { address: typed }),
        deliveryOption: delivery,
        discountCode: discountCode ?? undefined,
        payment: payment === "card" ? { method: "card", last4: last4 || undefined } : { method: "wallet" },
      });
      router.push(`/order/${order.id}/confirmation`);
      clear();
    } catch (err) {
      setPlacing(false);
      const e = err instanceof AccountApiError ? err : null;
      if (e?.code === "sign_in_required") return router.push(loginHref(window.location.pathname));
      setOrderError({ code: e?.code ?? "server_error", lines: e?.lines ?? [] });
    }
  };

  /** "Only 2 left of Bath sheet / Sage" — names in the page language */
  const stockProblem = (l: OutOfStockLine) => {
    const name = [nameOf({ productId: l.productId, title: l.productId }), variantLabel({ size: l.size, color: l.colour }, l.productId)].filter(Boolean).join(" · ");
    return l.available > 0 ? t("orderErrors.onlyLeft", { item: name, count: l.available }) : t("orderErrors.soldOut", { item: name });
  };

  if (!hydrated) {
    return (
      <p role="status" className="py-20 text-center text-lg">
        <TextShimmer>{t("preparing")}</TextShimmer>
      </p>
    );
  }

  if (items.length === 0 && !placing) {
    return (
      <div className="mx-auto max-w-md rounded-sm border bg-card p-8 text-center">
        <h1 className="text-3xl text-balance [overflow-wrap:anywhere]">{t("emptyTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
        <Button asChild className="mt-4">
          <Link href="/">{t("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  const err = (k?: string) => (k ? t(`errors.${k}`) : undefined);
  const fid = (f: string) => `${uid}-${f}`;

  return (
    <div className="space-y-6">
      <Link href="/cart" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("backToBag")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-4xl text-balance [overflow-wrap:anywhere] hyphens-auto sm:text-6xl">
          {t("title")}
          <span className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" /> {t("secureItems", { count })}
          </span>
        </h1>
      </div>
      <StepIndicator steps={STEPS} current={step} onStepClick={go} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <TransitionPanel activeIndex={step} direction={direction}>
            {/* 1. Address */}
            <StepCard title={t("address.title")}>
              <fieldset className="space-y-3">
                <legend className="sr-only">{t("address.choose")}</legend>
                {book.map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-sm border p-4 text-sm transition-colors",
                      chosenId === a.id ? "border-navy bg-cream/60" : "hover:border-foreground/30",
                    )}
                  >
                    <Radio name="address" className="mt-0.5" checked={chosenId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="font-semibold">{a.fullName}</span>
                      {a.label && <> · {addressLabel(a)}</>}
                      <span className="block text-muted-foreground">{addressLine(a)}</span>
                      <span className="block text-muted-foreground">
                        {countryName(a.country)} · {a.phone}
                      </span>
                    </span>
                  </label>
                ))}
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm border p-4 text-sm font-semibold",
                    chosenId === "new" ? "border-navy bg-cream/60" : "hover:border-foreground/30",
                  )}
                >
                  <Radio name="address" checked={chosenId === "new"} onChange={() => setAddressId("new")} />
                  <Plus className="size-4" aria-hidden="true" /> {t("address.addNew")}
                </label>
              </fieldset>

              {chosenId === "new" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2" data-form="address">
                  {Object.values(addressErrors).some(Boolean) && (
                    <p role="alert" className="text-sm text-danger sm:col-span-2">
                      {t("errors.summary")}
                    </p>
                  )}
                  <Field label={t("address.fullName")} id={fid("name")} autoComplete="name" className="sm:col-span-2" value={draft.fullName} onChange={(e) => setField("fullName", e.target.value)} error={err(addressErrors.fullName)} />
                  <Field label={t("address.street")} id={fid("line1")} autoComplete="address-line1" className="sm:col-span-2" value={draft.line1} onChange={(e) => setField("line1", e.target.value)} error={err(addressErrors.line1)} />
                  <Field label={t("address.apt")} id={fid("line2")} autoComplete="address-line2" className="sm:col-span-2" value={draft.line2 ?? ""} onChange={(e) => setField("line2", e.target.value)} />
                  <Field label={t("address.city")} id={fid("city")} autoComplete="address-level2" value={draft.city} onChange={(e) => setField("city", e.target.value)} error={err(addressErrors.city)} />
                  <Field label={t("address.region")} id={fid("region")} autoComplete="address-level1" value={draft.region} onChange={(e) => setField("region", e.target.value)} error={err(addressErrors.region)} />
                  <Field label={t("address.postalCode")} id={fid("zip")} autoComplete="postal-code" value={draft.postalCode} onChange={(e) => setField("postalCode", e.target.value)} error={err(addressErrors.postalCode)} />
                  <div className="space-y-1.5">
                    <Label htmlFor={fid("country")}>{t("address.country")}</Label>
                    <Select id={fid("country")} autoComplete="country" value={draft.country} onChange={(e) => setField("country", e.target.value)}>
                      {siteConfig.shippingCountries.map((c) => (
                        <option key={c} value={c}>
                          {countryName(c)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Field label={t("address.phone")} id={fid("phone")} type="tel" autoComplete="tel" className="sm:col-span-2" value={draft.phone} onChange={(e) => setField("phone", e.target.value)} error={err(addressErrors.phone)} />
                  <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
                    <Checkbox checked={saveToBook} onChange={(e) => setSaveToBook(e.target.checked)} /> {t("address.save")}
                  </label>
                  {saveToBook && (
                    <label className="-mt-2 flex min-h-10 items-center gap-2 pl-6 text-sm sm:col-span-2">
                      <Checkbox checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} /> {t("address.makeDefault")}
                    </label>
                  )}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <Button size="lg" onClick={continueFromAddress}>
                  {t("address.next")}
                </Button>
              </div>
            </StepCard>

            {/* 2. Delivery */}
            <StepCard title={t("deliveryTitle")}>
              <fieldset className="space-y-3">
                <legend className="sr-only">{t("chooseDelivery")}</legend>
                {deliveryOptions.map((d) => {
                  const price = shippingFor(d.id);
                  const Icon = deliveryIcons[d.id];
                  return (
                    <label
                      key={d.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-sm border p-4 text-sm transition-colors",
                        delivery === d.id ? "border-navy bg-cream/60" : "hover:border-foreground/30",
                      )}
                    >
                      <Radio name="delivery" checked={delivery === d.id} onChange={() => setDelivery(d.id)} />
                      <Icon className="size-5 shrink-0 text-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{deliveryName(d.id)}</span>
                        <span className="block text-muted-foreground">{deliveryDetail(d.id)}</span>
                      </span>
                      <span className="price font-semibold">{price === 0 ? t("free") : formatPrice(price)}</span>
                    </label>
                  );
                })}
              </fieldset>
              <ul className="mt-5 space-y-3 border-t pt-4">
                {items.map((i) => (
                  <li key={i.lineId} className="flex items-center gap-3 text-sm">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-sm border bg-cream">
                      <ProductImage src={i.image} alt={nameOf(i)} blurDataURL={i.imageBlur} sizes="48px" decorative iconClassName="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1">{nameOf(i)}</span>
                      <span className="text-xs text-muted-foreground">
                        {variantLabel(i.variant, i.productId) && `${variantLabel(i.variant, i.productId)} · `}
                        {t("qty", { count: i.quantity })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex justify-between gap-2">
                <Button variant="ghost" onClick={() => go(0)}>
                  {t("back")}
                </Button>
                <Button size="lg" onClick={() => go(2)}>
                  {t("toPayment")}
                </Button>
              </div>
            </StepCard>

            {/* 3. Payment */}
            <StepCard title={t("payment.title")}>
              <p className="mb-3 rounded-sm bg-warning-soft px-3 py-2 text-xs text-warning">{t("payment.demo")}</p>
              <fieldset className="space-y-3">
                <legend className="sr-only">{t("payment.choose")}</legend>
                {paymentOptions.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-sm border p-4 text-sm font-medium transition-colors",
                      payment === p.id ? "border-navy bg-cream/60" : "hover:border-foreground/30",
                    )}
                  >
                    <Radio name="payment" checked={payment === p.id} onChange={() => setPayment(p.id)} />
                    <p.icon className="size-5 shrink-0 text-foreground" aria-hidden="true" /> {p.id === "wallet" ? t("payment.wallet", { store: siteConfig.name, balance: fmt(42.1) }) : t("payment.cardOption")}
                  </label>
                ))}
              </fieldset>
              {payment === "card" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2" data-form="card">
                  {Object.values(cardErrors).some(Boolean) && (
                    <p role="alert" className="text-sm text-danger sm:col-span-2">
                      {t("errors.summary")}
                    </p>
                  )}
                  <Field label={t("payment.nameOnCard")} id={fid("cc-name")} autoComplete="off" className="sm:col-span-2" value={card.name} onChange={(e) => setCardField("name", e.target.value)} error={err(cardErrors.name)} />
                  <Field
                    label={t("payment.cardNumber")}
                    id={fid("cc-number")}
                    inputMode="numeric"
                    placeholder="4242 4242 4242 4242"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={card.number}
                    onChange={(e) => setCardField("number", groupDigits(e.target.value))}
                    error={err(cardErrors.number)}
                  />
                  <Field label={t("payment.expiry")} id={fid("cc-exp")} inputMode="numeric" placeholder="12/29" autoComplete="off" value={card.expiry} onChange={(e) => setCardField("expiry", formatExpiry(e.target.value))} error={err(cardErrors.expiry)} />
                  <Field label={t("payment.cvc")} id={fid("cc-cvc")} inputMode="numeric" placeholder="123" autoComplete="off" maxLength={4} value={card.cvc} onChange={(e) => setCardField("cvc", e.target.value.replace(/\D/g, ""))} error={err(cardErrors.cvc)} />
                  <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
                    <Checkbox defaultChecked /> {t("payment.billingSame")}
                  </label>
                </div>
              )}
              <div className="mt-6 flex justify-between gap-2">
                <Button variant="ghost" onClick={() => go(1)}>
                  {t("back")}
                </Button>
                <Button size="lg" onClick={continueFromPayment}>
                  {t("toReview")}
                </Button>
              </div>
            </StepCard>

            {/* 4. Review */}
            <StepCard title={t("review.title")}>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                {[
                  {
                    label: t("review.shipTo"),
                    v: address ? (
                      <>
                        <span className="block font-medium">{address.fullName}</span>
                        <span className="block">{addressLine(address)}</span>
                        <span className="block">{countryName(address.country)}</span>
                        <span className="block text-muted-foreground">{address.phone}</span>
                      </>
                    ) : null,
                    s: 0,
                  },
                  { label: t("review.delivery"), v: deliveryLabel(delivery), s: 1 },
                  { label: t("review.payment"), v: paymentLabel(paymentCode), s: 2 },
                ].map((row) => (
                  <div key={row.label} className="min-w-0 rounded-sm border p-4 [overflow-wrap:anywhere]">
                    <dt className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                      {row.label}
                      <button type="button" onClick={() => go(row.s)} className="-my-2 inline-flex min-h-10 items-center gap-1 text-foreground hover:underline">
                        <Pencil className="size-3" aria-hidden="true" /> {t("review.edit")}
                      </button>
                    </dt>
                    <dd className="mt-1">{row.v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-5 divide-y">
                {items.map((i) => {
                  const product = getProductById(i.productId, { includeHidden: true, locale });
                  return (
                    <li key={i.lineId} className="flex items-center gap-3 py-3 text-sm">
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-sm border bg-cream">
                        <ProductImage src={i.image} alt={nameOf(i)} blurDataURL={i.imageBlur} sizes="56px" decorative iconClassName="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {product ? (
                          <Link href={productHref(product, i.variant?.color)} className="line-clamp-1 font-medium hover:underline">
                            {nameOf(i)}
                          </Link>
                        ) : (
                          <span className="line-clamp-1 font-medium">{nameOf(i)}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {variantLabel(i.variant, i.productId) && `${variantLabel(i.variant, i.productId)} · `}
                          {t("qty", { count: i.quantity })}
                        </span>
                      </span>
                      <span className="price font-semibold">{formatPrice(i.price * i.quantity)}</span>
                    </li>
                  );
                })}
              </ul>
              {orderError && (
                <div role="alert" className="mt-5 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                  <p className="font-semibold">{orderError.code === "out_of_stock" ? t("orderErrors.outOfStock") : accountErrorMessage(orderError.code)}</p>
                  {orderError.lines.length > 0 && (
                    <ul className="mt-1 list-disc pl-5">
                      {orderError.lines.map((l) => (
                        <li key={`${l.productId}|${l.size ?? ""}|${l.colour ?? ""}`}>{stockProblem(l)}</li>
                      ))}
                    </ul>
                  )}
                  {orderError.code === "out_of_stock" && (
                    <Link href="/cart" className="mt-2 inline-flex min-h-10 items-center font-semibold underline underline-offset-4">
                      {t("orderErrors.editBag")}
                    </Link>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-wrap justify-between gap-2">
                <Button variant="ghost" onClick={() => go(2)}>
                  {t("back")}
                </Button>
                <Button size="lg" disabled={placing} onClick={placeOrder}>
                  {placing ? (
                    <>
                      <LoaderCircle className="animate-spin" aria-hidden="true" /> {t("placing")}
                    </>
                  ) : (
                    <>{t("placeOrder", { total: formatPrice(totals.total) })}</>
                  )}
                </Button>
              </div>
              <p className="mt-3 text-right text-xs text-muted-foreground">{t("terms")}</p>
            </StepCard>
          </TransitionPanel>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary {...totals} itemCount={count} showProgress={false} shippingLabel={t("deliveryLine", { option: deliveryName(delivery) })} />
        </div>
      </div>
    </div>
  );
}
