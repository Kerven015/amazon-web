import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { clientId, renderGoogleButton } from "@/lib/google";
import type { SessionUser } from "@/lib/account-api";

/** Google's "G" mark, as its sign-in branding guidelines require on a custom button */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

type State = "checking" | "off" | "idle" | "loading" | "ready";

/**
 * "or" + "Continue with Google". Google's script is NOT loaded until the shopper clicks: the
 * click loads it and shows Google's own button in its place, which opens the account chooser.
 * Renders nothing when Google sign-in isn't configured on the server.
 */
export function GoogleButton({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const t = useT("auth");
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("checking");
  const callback = useRef(onSignedIn);
  callback.current = onSignedIn;

  // Asks our own server whether Google sign-in is on (no request to Google)
  useEffect(() => {
    let live = true;
    void clientId().then((id) => live && setState(id ? "idle" : "off"));
    return () => {
      live = false;
    };
  }, []);

  const load = async () => {
    if (!ref.current) return;
    setState("loading");
    const ok = await renderGoogleButton(ref.current, (u) => callback.current(u));
    if (ok) setState("ready");
    else {
      setState("idle");
      toast.error(t("google.failed"));
    }
  };

  if (state === "checking" || state === "off") return null;
  return (
    <div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
      </div>
      {state !== "ready" && (
        <button
          type="button"
          onClick={load}
          disabled={state === "loading"}
          className="flex min-h-11 w-full items-center justify-center gap-3 rounded-sm border border-[#747775] bg-white px-4 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa] disabled:opacity-70 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]"
        >
          {state === "loading" ? <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" /> : <GoogleMark />}
          {t("google.continue")}
        </button>
      )}
      {state === "ready" && <p className="mb-2 text-center text-xs text-muted-foreground" aria-live="polite">{t("google.ready")}</p>}
      {/* Google draws its button (an iframe) in here after the click; kept in the layout so it can size itself */}
      <div ref={ref} className={state === "ready" ? "flex min-h-11 w-full justify-center" : "invisible h-0 w-full overflow-hidden"} data-testid="google-button" />
      {state !== "ready" && <p className="mt-2 text-center text-xs text-muted-foreground">{t("google.note")}</p>}
    </div>
  );
}
