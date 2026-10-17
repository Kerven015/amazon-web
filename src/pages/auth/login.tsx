import type { LoaderFunctionArgs } from "react-router";
import { AuthForm } from "@/components/auth/auth-form";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { redirectIfSignedIn } from "@/lib/session";

/** Already signed in → straight to where they were going. */
export const loginLoader = ({ request, params }: LoaderFunctionArgs) => redirectIfSignedIn(request, params.locale ?? "en");

export default function LoginPage() {
  const t = useT();
  return (
    <>
      <PageTitle title={t("auth.signInTitle")} />
      <AuthForm mode="login" />
    </>
  );
}
