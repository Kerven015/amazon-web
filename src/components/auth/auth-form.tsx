import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Link, useRouter, useSearchParams } from "@/lib/router";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/input";
import { useLocale, useT } from "@/i18n";
import { AccountApiError, accountApi, accountErrorMessage } from "@/lib/account-api";
import { PASSWORD_MIN, safeNext } from "@/lib/account-schema";
import { siteConfig } from "@/lib/config";
import { signedIn } from "@/lib/session";
import { cn } from "@/lib/utils";
import { validateEmail } from "@/components/layout/newsletter";

function PasswordInput({ id, autoComplete, value, onChange, error, describedBy }: { id: string; autoComplete: string; value: string; onChange: (v: string) => void; error?: boolean; describedBy?: string }) {
  const [show, setShow] = useState(false);
  const t = useT("auth");
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("hidePassword") : t("showPassword")}
        aria-pressed={show}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH = ["tooWeak", "weak", "fair", "good", "strong"] as const;

/**
 * Sign in / create account against the customer API. After success the shopper
 * goes back to `?next=` (only paths on this site), or to their account.
 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const id = useId();
  const router = useRouter();
  const locale = useLocale();
  const t = useT("auth");
  const rawNext = useSearchParams().get("next");
  const next = safeNext(rawNext, `/${locale}/account`);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "password" | "agree" | "form", string>>>({});
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";
  const score = strength(password);

  /** The site's own messages (in the page language) instead of the browser's validation bubbles. */
  const validate = () => {
    const errs: typeof errors = {};
    if (isRegister && !name.trim()) errs.name = t("errors.name");
    const emailError = validateEmail(email);
    if (emailError) errs.email = emailError;
    if (!password) errs.password = t("errors.passwordEmpty");
    else if (isRegister && password.length < PASSWORD_MIN) errs.password = t("errors.password");
    if (isRegister && !agree) errs.agree = t("errors.agree");
    return errs;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-form="${id}"] [aria-invalid="true"]`)?.focus());
      return;
    }
    setLoading(true);
    try {
      const { user } = isRegister
        ? await accountApi.register({ name: name.trim(), email: email.trim(), password, locale })
        : await accountApi.login({ email: email.trim(), password, remember });
      // Merges this browser's bag, wishlist and addresses into the account
      await signedIn(user);
      toast.success(isRegister ? t("createdToast") : t("signedInToast", { name: user.name.split(" ")[0] }));
      router.replace(next);
    } catch (err) {
      setLoading(false);
      const e = err instanceof AccountApiError ? err : null;
      if (e?.code === "validation" && e.fields.password) setErrors({ password: t("errors.password") });
      else if (e?.code === "validation" && e.fields.email) setErrors({ email: validateEmail(email) ?? accountErrorMessage(e) });
      else if (e?.code === "email_taken") setErrors({ email: accountErrorMessage(e) });
      else setErrors({ form: accountErrorMessage(err) });
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-form="${id}"] [aria-invalid="true"], #${CSS.escape(`${id}-form-error`)}`)?.focus());
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-sm border bg-card p-6 shadow-card sm:p-8">
        <h1 className="text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto">{isRegister ? t("registerHeading") : t("signInTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isRegister ? t("registerIntro", { store: siteConfig.name }) : t("signInIntro")}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate data-form={id}>
          {errors.form && (
            <p id={`${id}-form-error`} role="alert" tabIndex={-1} className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger outline-none">
              {errors.form}
            </p>
          )}
          <AnimatePresence initial={false}>
            {isRegister && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                <Label htmlFor={`${id}-name`}>{t("fullName")}</Label>
                <Input id={`${id}-name`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? `${id}-name-error` : undefined} />
                {errors.name && <p id={`${id}-name-error`} className="text-xs text-danger">{errors.name}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-email`}>{t("email")}</Label>
            <Input id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
            {errors.email && <p id={`${id}-email-error`} className="text-xs text-danger">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-pw`}>{t("password")}</Label>
            <PasswordInput
              id={`${id}-pw`}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={setPassword}
              error={!!errors.password}
              describedBy={errors.password ? `${id}-pw-error` : undefined}
            />
            {errors.password && <p id={`${id}-pw-error`} className="text-xs text-danger">{errors.password}</p>}
            {isRegister && (
              <div aria-live="polite">
                <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 rounded-full transition-colors",
                        i < score ? (score <= 1 ? "bg-danger" : score <= 2 ? "bg-warning" : "bg-success") : "bg-border",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{password ? t(`strength.${STRENGTH[score]}`) : t("passwordHint")}</p>
              </div>
            )}
          </div>

          {isRegister ? (
            <div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  className="mt-0.5"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  aria-invalid={errors.agree ? true : undefined}
                  aria-describedby={errors.agree ? `${id}-agree-error` : undefined}
                />{" "}
                {t("agree")}
              </label>
              {errors.agree && <p id={`${id}-agree-error`} className="mt-1 text-xs text-danger">{errors.agree}</p>}
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("keepSignedIn")}
            </label>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {isRegister ? t("createAccount") : t("signIn")}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isRegister ? t("haveAccount") : t("newTo", { store: siteConfig.name })}{" "}
        {/* Keeps ?next= so a new customer also ends up where they were going (e.g. checkout) */}
        <Link href={`${isRegister ? "/login" : "/register"}${rawNext ? `?next=${encodeURIComponent(next)}` : ""}`} className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
          {isRegister ? t("signIn") : t("createAnAccount")}
        </Link>
      </p>
    </div>
  );
}
