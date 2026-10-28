import * as Dialog from "@radix-ui/react-dialog";
import { EditorialImage } from "@/components/ui/editorial-image";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { siteConfig } from "@/lib/config";
import { usePanels } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import { translate, useLocale, useT } from "@/i18n";
import { accountApi, accountErrorMessage } from "@/lib/account-api";
import { Link, usePathname } from "@/lib/router";

const STORAGE_KEY = "vendora-newsletter";

/** Email check with translated messages (messages → newsletter.errors). */
export function validateEmail(email: string): string | null {
  const v = email.trim();
  const e = (key: string) => translate(`newsletter.errors.${key}`, { value: v });
  if (!v) return e("empty");
  if (!v.includes("@")) return e("missingAt");
  const [user, domain] = v.split("@");
  if (!user) return e("missingUser");
  if (!domain) return e("missingDomain");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return e("invalid");
  return null;
}
const validate = validateEmail;

function remember(value: "subscribed" | "dismissed") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

/** Email field with inline validation; the address is saved on the server (POST /api/newsletter). */
export function NewsletterForm({ tone = "default", onDone }: { tone?: "default" | "inverse"; onDone?: () => void }) {
  const id = useId();
  const t = useT("newsletter");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p role="status" className="inline-flex items-start gap-2 text-sm">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t.rich("done", { code: <strong className="font-semibold tracking-wide">{siteConfig.welcomeCode}</strong> })}</span>
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTouched(true);
        const err = validate(email);
        setError(err);
        if (err || busy) return;
        setBusy(true);
        try {
          await accountApi.subscribeNewsletter(email.trim(), locale);
          setDone(true);
          remember("subscribed");
          onDone?.();
        } catch (failure) {
          setError(accountErrorMessage(failure));
        } finally {
          setBusy(false);
        }
      }}
      className="w-full"
    >
      <label htmlFor={`${id}-email`} className="sr-only">
        {t("emailLabel")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          placeholder={t("placeholder")}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (touched) setError(validate(e.target.value));
          }}
          onBlur={() => {
            if (email) {
              setTouched(true);
              setError(validate(email));
            }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : `${id}-note`}
          className={cn(
            "h-12 min-w-0 flex-1 rounded-sm border bg-transparent px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground aria-[invalid=true]:border-danger",
            tone === "inverse" ? "border-input" : "border-input bg-surface",
          )}
        />
        <button
          type="submit"
          disabled={busy}
          className="h-12 shrink-0 disabled:opacity-60 whitespace-nowrap rounded-sm bg-foreground px-7 text-[13px] font-medium tracking-[0.04em] text-background transition-opacity hover:opacity-90"
        >
          {t("signUp")}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-err`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-xs text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <p id={`${id}-note`} className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t("consent", { store: siteConfig.name })}{" "}
        <Link href="/help/privacy" className="underline underline-offset-2">{t("privacy")}</Link>.
      </p>
    </form>
  );
}

export function NewsletterBlock() {
  const t = useT("newsletter");
  return (
    <section aria-labelledby="newsletter-h" className="mx-auto max-w-xl text-center">
      <h2 id="newsletter-h" className="text-4xl leading-tight sm:text-5xl">
        {t("blockTitle")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] text-muted-foreground">{t("blockBody")}</p>
      <div className="mt-6 text-left">
        <NewsletterForm />
      </div>
    </section>
  );
}

/** Pages where a popup would get in the way of shopping or account tasks (paths without the locale). */
const QUIET_PATHS = /^\/(products\/|cart(\/|$)|checkout(\/|$)|order\/|account|login(\/|$)|register(\/|$))/;
const VIEWS_KEY = "vendora-newsletter-views";
const START_KEY = "vendora-newsletter-start";
const MIN_VIEWS = 3;
const MIN_MS = 30_000;
/** Desktop: after the gate opens, wait this long for exit intent before showing anyway. */
const DESKTOP_FALLBACK_MS = 30_000;

function session(key: string, fallback: number) {
  try {
    return Number(sessionStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function setSession(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    /* private mode — counting just restarts */
  }
}

/**
 * Shown once per browser, and only when it won't interrupt: never on product,
 * bag, checkout, order, account or sign-in pages, and only after the visitor has
 * seen 3+ pages and spent 30+ seconds on the site (this visit).
 * Desktop: then on exit intent (pointer leaving the top of the window), or 30s later.
 * Phones and tablets: a small bottom sheet instead of a centred modal.
 * Dismissal or sign-up is remembered in localStorage.
 */
export function NewsletterPopup() {
  const t = useT("newsletter");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const anotherOpen = usePanels((s) => s.open !== null);
  const quiet = QUIET_PATHS.test(pathname);

  // Count page views and remember when the visit started (once per path, even in StrictMode).
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (counted.current === pathname) return;
    counted.current = pathname;
    setSession(VIEWS_KEY, session(VIEWS_KEY, 0) + 1);
    if (!session(START_KEY, 0)) setSession(START_KEY, Date.now());
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (quiet || open) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(STORAGE_KEY);
    } catch {
      seen = "dismissed";
    }
    if (seen) return;

    const show = () => {
      if (usePanels.getState().open || QUIET_PATHS.test(window.location.pathname.replace(/^\/(en|tr|tk|ru)(?=\/|$)/, ""))) return;
      setOpen(true);
    };
    const gateOpen = () => session(VIEWS_KEY, 0) >= MIN_VIEWS && Date.now() - session(START_KEY, Date.now()) >= MIN_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)").matches;

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget && gateOpen()) show();
    };
    const whenGateOpens = () => {
      if (desktop) {
        document.addEventListener("mouseout", onLeave);
        timers.push(setTimeout(show, DESKTOP_FALLBACK_MS));
      } else {
        show();
      }
    };
    if (session(VIEWS_KEY, 0) >= MIN_VIEWS) {
      const wait = Math.max(0, MIN_MS - (Date.now() - session(START_KEY, Date.now())));
      timers.push(setTimeout(whenGateOpens, wait));
    }
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("mouseout", onLeave);
    };
  }, [pathname, quiet, open]);

  const dismiss = () => {
    setOpen(false);
    remember("dismissed");
  };

  return (
    <Dialog.Root open={open && !anotherOpen && !quiet} onOpenChange={(o) => !o && dismiss()} modal={!mobile}>
      <Dialog.Portal>
        {!mobile && <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1a1714]/45 data-[state=open]:animate-[fade-in_300ms_ease-out]" />}
        <Dialog.Content
          data-testid="newsletter-popup"
          data-variant={mobile ? "sheet" : "modal"}
          onInteractOutside={mobile ? (e) => e.preventDefault() : undefined}
          className={cn(
            "fixed z-50 overflow-hidden bg-surface shadow-pop outline-none",
            mobile
              ? "inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-sm border-t data-[state=open]:animate-[sheet-in-bottom_320ms_var(--ease-calm-curve)]"
              : "left-1/2 top-1/2 grid w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-sm data-[state=open]:animate-[fade-in_400ms_ease-out] md:grid-cols-2",
          )}
        >
          <div className={cn("relative", mobile ? "hidden" : "hidden md:block")}>
            <EditorialImage seed="vd-newsletter" width={700} height={900} alt="" fill sizes="384px" className="object-cover" />
          </div>
          <div className={cn("relative", mobile ? "px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6" : "px-6 pb-8 pt-12 sm:px-10")}>
            <Dialog.Close aria-label={t("close")} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full hover:bg-muted">
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
            <p className="eyebrow text-muted-foreground">{t("popupEyebrow")}</p>
            <Dialog.Title className={cn("mt-2 pr-8 font-serif leading-tight [overflow-wrap:anywhere]", mobile ? "text-2xl" : "text-4xl")}>{t("popupTitle")}</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-muted-foreground">{t("popupBody")}</Dialog.Description>
            <div className={mobile ? "mt-4" : "mt-6"}>
              {/* Stays open after signing up so the shopper can note the code */}
              <NewsletterForm />
            </div>
            <button type="button" onClick={dismiss} className="mt-2 inline-flex min-h-10 items-center text-xs text-muted-foreground underline underline-offset-4">
              {t("noThanks")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
