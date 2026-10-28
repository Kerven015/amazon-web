import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { accountApi } from "@/lib/account-api";
import { Link } from "@/lib/router";

/** /:locale/newsletter/unsubscribe?token=… — the link at the bottom of every newsletter email. */
export default function NewsletterUnsubscribePage() {
  const t = useT("newsletter.unsubscribe");
  const token = useSearchParams()[0].get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "invalid" | "failed">(token ? "working" : "invalid");

  useEffect(() => {
    if (!token) return;
    accountApi.unsubscribeNewsletter(token).then(
      () => setState("done"),
      (err: { status?: number }) => setState(err?.status === 404 ? "invalid" : "failed"),
    );
  }, [token]);

  return (
    <Container className="max-w-xl py-20 text-center">
      <PageTitle title={t("title")} />
      <meta name="robots" content="noindex" />
      <h1 className="text-4xl">{t("title")}</h1>
      <p className="mt-6 inline-flex items-start gap-2 text-[15px] text-muted-foreground" role="status">
        {state === "working" && <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />}
        {state === "done" && <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
        {(state === "invalid" || state === "failed") && <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />}
        <span>{t(state)}</span>
      </p>
      <p className="mt-8">
        <Link href="/" className="underline underline-offset-4">{t("backToShop")}</Link>
      </p>
    </Container>
  );
}
