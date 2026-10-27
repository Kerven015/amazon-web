/**
 * Google Identity Services in the browser: the "Continue with Google" button.
 *
 * Privacy: Google's script is loaded only after the visitor clicks "Continue with Google"
 * (components/auth/google-button.tsx). Until then no request goes to Google, so Google can't
 * see or set cookies on visits to the shop. (That's also why there's no One Tap.)
 *
 * Google gives the browser an ID token; we send it to POST /api/auth/google, where the
 * server checks it with Google's keys and signs the customer in. Nothing from Google is
 * trusted in the browser itself.
 *
 * Without GOOGLE_CLIENT_ID on the server (GET /api/auth/config → null), all of this stays
 * hidden and Google's script isn't even loaded.
 */
import { toast } from "sonner";
import { getActiveLocale, translate } from "@/i18n";
import { accountApi, accountErrorMessage, type SessionUser } from "@/lib/account-api";
import { signedIn } from "@/lib/session";

type CredentialResponse = { credential: string };
type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
  disableAutoSelect: () => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";

let configPromise: Promise<string | null> | null = null;
let scriptPromise: Promise<GoogleId> | null = null;
let initialized = false;
/** What to do after a successful Google sign-in (the sign-in page sends the shopper on to ?next=) */
let afterSignIn: ((user: SessionUser) => void) | null = null;

/** Our own server's setting (no request to Google): is Google sign-in switched on? */
export function clientId() {
  configPromise ??= fetch("/api/auth/config", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { googleClientId: null }))
    .then((c: { googleClientId: string | null }) => c.googleClientId)
    .catch(() => null);
  return configPromise;
}

function loadScript(): Promise<GoogleId> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google script loaded without an API")));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function onCredential({ credential }: CredentialResponse) {
  try {
    const { user, created } = await accountApi.google(credential, getActiveLocale());
    // Merges this browser's bag, wishlist and addresses into the account, like a normal sign-in
    await signedIn(user);
    toast.success(created ? translate("auth.createdToast") : translate("auth.signedInToast", { name: user.name.split(" ")[0] }));
    afterSignIn?.(user);
  } catch (err) {
    toast.error(accountErrorMessage(err));
  }
}

/** Loads and sets up Google sign-in once. Resolves to null when it's not available (not configured, blocked, offline). */
export async function getGoogle(): Promise<GoogleId | null> {
  if (typeof window === "undefined") return null;
  const id = await clientId();
  if (!id) return null;
  try {
    const g = await loadScript();
    if (!initialized) {
      g.initialize({ client_id: id, callback: onCredential, context: "signin" });
      initialized = true;
    }
    return g;
  } catch {
    return null;
  }
}

/** Google's official button, drawn into `el`. Returns false when Google sign-in isn't available. */
export async function renderGoogleButton(el: HTMLElement, onSignedIn: (user: SessionUser) => void) {
  const g = await getGoogle();
  if (!g || !el.isConnected) return false;
  afterSignIn = onSignedIn;
  const dark = document.documentElement.classList.contains("dark");
  g.renderButton(el, {
    type: "standard",
    theme: dark ? "filled_black" : "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "center",
    width: Math.min(400, Math.max(200, Math.floor(el.clientWidth))),
    locale: getActiveLocale(),
  });
  return true;
}
