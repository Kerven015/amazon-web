/**
 * The signed-in customer, and keeping their bag, wishlist and address book in the account.
 *
 * - `useSession()` — { status: "unknown" | "signedIn" | "signedOut", user }. Loaded once from
 *   GET /api/auth/me, updated after sign in / sign out.
 * - Signed out: the bag, wishlist and address book stay in localStorage, as before.
 * - Signing in (or opening the site while signed in): whatever is in this browser is merged
 *   into the account, the local copies are cleared, and from then on the stores mirror the
 *   account — so it's the same bag on every device. Orders only exist in the account.
 */
import { redirect } from "react-router";
import { toast } from "sonner";
import { translate } from "@/i18n";
import { accountApi, type CartLine, type SessionUser } from "@/lib/account-api";
import { safeNext } from "@/lib/account-schema";
import { ensureCatalog, getProductById } from "@/lib/catalog";
import { isSignedIn, useSession } from "@/lib/session-state";
import { toCartItem, useCart } from "@/lib/store/cart";
import { useAddressBook } from "@/lib/store/addresses";
import { useMyReviews } from "@/lib/store/my-reviews";
import { useWishlist } from "@/lib/store/wishlist";

export type { SessionUser };
export { isSignedIn, useSession };

/** First name for the header ("Ada Lovelace" → "Ada"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* ------------------------------ loading ------------------------------ */

let sessionPromise: Promise<SessionUser | null> | null = null;
let syncPromise: Promise<void> = Promise.resolve();

/** Who's signed in (asks the server once per page load). */
export function loadSession(): Promise<SessionUser | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  sessionPromise ??= accountApi
    .me()
    .catch(() => null)
    .then((user) => {
      if (user) {
        useSession.setState({ status: "signedIn", user });
        syncPromise = syncAccount();
      } else {
        useSession.setState({ status: "signedOut", user: null });
      }
      return user;
    });
  return sessionPromise;
}

/** Resolves once the session is known and (when signed in) the account data is loaded. */
export async function accountReady() {
  const user = await loadSession();
  await syncPromise;
  return user;
}

/** After a successful sign in / registration. */
export async function signedIn(user: SessionUser) {
  sessionPromise = Promise.resolve(user);
  useSession.setState({ status: "signedIn", user });
  syncPromise = syncAccount();
  await syncPromise;
}

/** Profile changes (name / email) show up in the header straight away. */
export function updateSessionUser(patch: Partial<SessionUser>) {
  const { user } = useSession.getState();
  if (user) useSession.setState({ user: { ...user, ...patch } });
}

/** Sign out here (or everywhere). The browser keeps nothing from the account. */
export async function signOut({ everywhere = false } = {}) {
  try {
    await (everywhere ? accountApi.logoutAll() : accountApi.logout());
  } finally {
    // Otherwise Google One Tap would sign them straight back in on the next page
    window.google?.accounts?.id?.disableAutoSelect();
    stopMirroring();
    sessionPromise = Promise.resolve(null);
    syncPromise = Promise.resolve();
    useSession.setState({ status: "signedOut", user: null });
    useCart.setState({ items: [], discountCode: null });
    useWishlist.setState({ ids: [] });
    useAddressBook.setState({ addresses: [] });
    useMyReviews.setState({ ids: [] });
  }
}

/**
 * Loaders of pages that need an account (/checkout, /account, orders):
 * signed out → /{locale}/login?next=<this page>, and back here after signing in.
 */
export async function requireSignIn(request: Request, locale: string) {
  const user = await accountReady();
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/${locale}/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return user;
}

/** /login and /register when already signed in → where they were going. */
export async function redirectIfSignedIn(request: Request, locale: string) {
  const user = await loadSession();
  if (user) throw redirect(safeNext(new URL(request.url).searchParams.get("next"), `/${locale}/account`));
  return null;
}

/** The sign-in link for a page: /login?next=/{locale}/checkout */
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/* ------------------------------ syncing ------------------------------ */

let applying = false;
let unsubscribe: (() => void)[] = [];

function stopMirroring() {
  unsubscribe.forEach((u) => u());
  unsubscribe = [];
}

const cartLines = (items: { productId: string; quantity: number; variant: { size?: string; color?: string } }[]): CartLine[] =>
  items.map((i) => ({ productId: i.productId, size: i.variant.size, colour: i.variant.color, quantity: i.quantity }));

function debounce(fn: () => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

const syncFailed = () => toast.error(translate("accountErrors.syncFailed"));

/** Merge this browser's data into the account, then mirror the account. */
async function syncAccount() {
  stopMirroring();
  try {
    // The stores must have read localStorage before we can merge it
    await Promise.all([useCart, useWishlist, useAddressBook].map((s) => (s.persist.hasHydrated() ? null : s.persist.rehydrate())));
    await ensureCatalog().catch(() => {});

    // 1. Merge what's in this browser into the account, then clear the local copies
    const localCart = cartLines(useCart.getState().items);
    const localWishlist = useWishlist.getState().ids;
    const localAddresses = useAddressBook.getState().addresses;
    await Promise.all([
      localCart.length ? accountApi.saveCart(localCart, "merge") : null,
      localWishlist.length ? accountApi.saveWishlist(localWishlist, "merge") : null,
    ]);
    for (const { id: _id, ...a } of localAddresses) await accountApi.addAddress(a, { dedupe: true }).catch(() => {});
    for (const key of ["vendora-wishlist", "vendora-addresses"]) localStorage.removeItem(key);

    // 2. Load the account into the stores
    const [cart, wishlist, addresses, reviews] = await Promise.all([accountApi.cart(), accountApi.wishlist(), accountApi.addresses(), accountApi.myReviews()]);
    applying = true;
    useCart.setState({
      items: cart.items.flatMap((l) => {
        const product = getProductById(l.productId);
        return product ? [toCartItem(product, { size: l.size, color: l.colour }, l.quantity)] : [];
      }),
    });
    useWishlist.setState({ ids: wishlist.ids });
    useAddressBook.setState({ addresses: addresses.addresses });
    useMyReviews.setState({ ids: reviews.reviews.map((r) => r.id) });
    applying = false;

    // 3. From now on, changes in this browser are saved to the account
    const pushCart = debounce(() => {
      if (isSignedIn()) accountApi.saveCart(cartLines(useCart.getState().items)).catch(syncFailed);
    }, 400);
    const pushWishlist = debounce(() => {
      if (isSignedIn()) accountApi.saveWishlist(useWishlist.getState().ids).catch(syncFailed);
    }, 400);
    unsubscribe = [
      useCart.subscribe((s, prev) => !applying && s.items !== prev.items && pushCart()),
      useWishlist.subscribe((s, prev) => !applying && s.ids !== prev.ids && pushWishlist()),
    ];
  } catch {
    applying = false;
    syncFailed();
  }
}
