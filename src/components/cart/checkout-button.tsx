import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n";
import { Link } from "@/lib/router";
import { loginHref, useSession } from "@/lib/session";

/**
 * "Proceed to checkout". Buying needs an account, so a signed-out shopper is sent to
 * sign in first (with a short note above the button) and lands on checkout afterwards,
 * with the same bag.
 */
export function CheckoutButton({ onClick, className, note = true }: { onClick?: () => void; className?: string; note?: boolean }) {
  const t = useT("cart");
  const locale = useLocale();
  const status = useSession((s) => s.status);
  // (While the session is still loading the link goes via /login, which forwards a signed-in shopper)
  const signedOut = status !== "signedIn";
  return (
    <>
      {status === "signedOut" && note && <p className="text-center text-xs text-muted-foreground">{t("signInToCheckout")}</p>}
      <Button asChild size="lg" className={className}>
        <Link href={signedOut ? loginHref(`/${locale}/checkout`) : "/checkout"} onClick={onClick}>
          {t("checkout")}
        </Link>
      </Button>
    </>
  );
}
