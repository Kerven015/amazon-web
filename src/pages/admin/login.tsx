import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { redirect, useNavigate, useSearchParams } from "react-router";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ApiError, adminApi } from "@/lib/admin-api";
import { siteConfig } from "@/lib/config";
import { AdminLanguageSwitcher } from "@/components/admin/admin-i18n";
import { useT } from "@/i18n";
import { adminError } from "@/lib/admin-errors";

/** Already signed in → straight to the admin. (The server also redirects; this covers client navigation.) */
export async function adminLoginLoader() {
  if (await adminApi.session()) throw redirect("/admin");
  return null;
}

const safeNext = (next: string | null) => (next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");

/** /admin/login — credentials are checked on the server (POST /api/admin/login). */
export default function AdminLoginPage() {
  const id = useId();
  const t = useT("admin.login");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(username, password);
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "__unreachable");
      // Keep the username, clear the password
      setPassword("");
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="theme-cream relative grid min-h-dvh place-items-center px-4 py-16">
      <title>{t("pageTitle", { store: siteConfig.name })}</title>
      {/* Admin language — the same switcher as on the product form */}
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <AdminLanguageSwitcher />
      </div>
      <meta name="robots" content="noindex, nofollow" />
      <main className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <form onSubmit={submit} noValidate className="rounded-sm border border-navy/10 bg-surface p-6 shadow-card sm:p-8" aria-describedby={error ? `${id}-err` : undefined}>
          <h1 className="text-center text-3xl">{t("title")}</h1>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-user`}>{t("username")}</Label>
              <Input
                id={`${id}-user`}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-pass`}>{t("password")}</Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id={`${id}-pass`}
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? t("hidePassword") : t("showPassword")}
                  aria-pressed={show}
                  className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" strokeWidth={1.5} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
          <Button type="submit" size="lg" className="mt-6 h-12 w-full" disabled={busy || !username || !password}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {t("submit")}
          </Button>
          {error && (
            <p id={`${id}-err`} role="alert" className="mt-4 text-center text-sm text-danger">
              {error === "__unreachable" ? t("unreachable") : adminError(error)}
            </p>
          )}
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/" className="underline underline-offset-4">{t("backToStore")}</a>
        </p>
      </main>
    </div>
  );
}
