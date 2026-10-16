import { AuthForm } from "@/components/auth/auth-form";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";

export default function RegisterPage() {
  const t = useT();
  return (
    <>
      <PageTitle title={t("auth.registerTitle")} />
      <AuthForm mode="register" key="register" />
    </>
  );
}
