import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { renderGoogleButton } from "@/lib/google";
import type { SessionUser } from "@/lib/account-api";

/**
 * "or" + Google's own "Continue with Google" button (Google requires its official design).
 * Renders nothing when Google sign-in isn't configured or Google can't be reached.
 */
export function GoogleButton({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const t = useT("auth");
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const callback = useRef(onSignedIn);
  callback.current = onSignedIn;

  useEffect(() => {
    let live = true;
    if (ref.current) void renderGoogleButton(ref.current, (u) => callback.current(u)).then((ok) => live && setReady(ok));
    return () => {
      live = false;
    };
  }, []);

  return (
    // Kept in the layout (just invisible) until ready, so Google can size the button to the form
    <div className={ready ? undefined : "invisible h-0 overflow-hidden"} aria-hidden={ready ? undefined : true}>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
      </div>
      {/* Google draws its button (an iframe) in here */}
      <div ref={ref} className="flex min-h-11 w-full justify-center" data-testid="google-button" />
    </div>
  );
}
