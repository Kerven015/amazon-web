import { useEffect } from "react";
import { formatPriceShort, useLocale, useT } from "@/i18n";
import { siteConfig } from "@/lib/config";

/**
 * Page <title> (React 19 hoists it into <head>) and meta description, both in
 * the current language. Without a title it shows the home title.
 */
export function PageTitle({ title, description }: { title?: string; description?: string }) {
  const t = useT("meta");
  const locale = useLocale();
  const desc = description ?? t("defaultDescription", { amount: formatPriceShort(siteConfig.freeShippingThreshold, locale) });

  // index.html has one description tag: update it in place
  useEffect(() => {
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (tag) tag.content = desc;
  }, [desc]);

  return <title>{title ? `${title} · ${siteConfig.name}` : t("homeTitle", { store: siteConfig.name })}</title>;
}
