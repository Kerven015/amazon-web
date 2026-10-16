import { AuthForm } from "@/components/auth/auth-form";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";

export default function LoginPage() {
  const t = useT();
  return (
    <>
      <PageTitle title={t("auth.signInTitle")} />
      <AuthForm mode="login" />
    </>
  );
}
