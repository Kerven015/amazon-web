import { ArrowUp, Facebook, Instagram, Youtube } from "lucide-react";
import { Link } from "@/lib/router";
import { useT } from "@/i18n";
import { siteConfig } from "@/lib/config";
import { ThemeToggle } from "./header-actions";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MenuAnchor } from "./menu-anchor";
import { NewsletterBlock } from "./newsletter";

/** Footer columns: labels in messages → footer.columns / footer.links */
const columns = [
  {
    key: "service",
    links: [
      { key: "contact", href: "/help/contact" },
      { key: "delivery", href: "/help/delivery" },
      { key: "returns", href: "/help/returns" },
      { key: "track", href: "/account?tab=orders" },
      { key: "account", href: "/account" },
    ],
  },
  {
    key: "about",
    links: [
      { key: "story", href: "/help/about" },
      { key: "credits", href: "/credits" },
    ],
  },
  {
    key: "guides",
    links: [
      { key: "buyingGuide", href: "/help/buying-guide" },
      { key: "careGuide", href: "/help/care" },
      { key: "sizeGuide", href: "/help/size-guide" },
      { key: "quiz", href: "#quiz" },
    ],
  },
];

/** Only profiles set in siteConfig.social are shown (no links to the networks' home pages). */
const socials = [
  { label: "Instagram", href: siteConfig.social.instagram, icon: Instagram },
  { label: "Facebook", href: siteConfig.social.facebook, icon: Facebook },
  { label: "YouTube", href: siteConfig.social.youtube, icon: Youtube },
].filter((s) => /^https:\/\/.+\/.+/.test(s.href));

export function Footer() {
  const t = useT("footer");

  return (
    <footer className="mt-24 border-t border-navy/10 bg-cream text-navy [&_.text-muted-foreground]:text-navy/75">
      {/* Newsletter first */}
      <div className="border-b border-navy/10 px-4 py-16 sm:py-20">
        <NewsletterBlock />
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-14 sm:px-5 lg:grid-cols-[1.2fr_2fr] lg:px-8">
        <div className="space-y-5">
          <Logo className="text-navy" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t("tagline")}</p>
          {socials.length > 0 && (
          <ul className="flex items-center gap-2" aria-label={t("followUs")}>
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t("socialLabel", { store: siteConfig.name, network: s.label })}
                  className="grid size-10 place-items-center rounded-full border border-navy/25 transition-colors duration-150 hover:border-navy"
                >
                  <s.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.key} className="min-w-0">
              <h2 className="font-sans text-[17px] font-semibold tracking-[-0.01em] text-navy">{t(`columns.${col.key}`)}</h2>
              <ul className="mt-5">
                {col.links.map((l) => (
                  <li key={l.key}>
                    <MenuAnchor link={l} className="mega-link footer-link">
                      <span className="mega-label">{t(`links.${l.key}`)}</span>
                    </MenuAnchor>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-navy/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <nav aria-label={t("legal")}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li><Link href="/help/terms" className="hover:text-navy hover:underline hover:underline-offset-[3px]">{t("termsLong")}</Link></li>
              <li><Link href="/help/privacy" className="hover:text-navy hover:underline hover:underline-offset-[3px]">{t("privacyLong")}</Link></li>
              <li><Link href="/help/cookies" className="hover:text-navy hover:underline hover:underline-offset-[3px]">{t("cookies")}</Link></li>
              <li>{t("copyright", { year: String(new Date().getFullYear()), store: siteConfig.name })}</li>
            </ul>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher placement="up" className="border border-navy/20" />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-xs text-navy hover:bg-navy/[0.06]"
            >
              <ArrowUp className="size-3.5" aria-hidden="true" /> {t("backToTop")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
