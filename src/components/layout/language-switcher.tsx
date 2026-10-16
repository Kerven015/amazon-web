import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { LOCALE_COOKIE, type Locale, localeNames, locales, localizePath, useLocale, useT } from "@/i18n";
import { cn } from "@/lib/utils";

/** Remember the choice for a year (the server reads it for the first redirect too). */
function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Switch language and stay on the same page: same path, filters (?query) and #hash,
 * just with the new /{locale} prefix. Page state (selected colour/size) is kept.
 */
export function useSwitchLocale() {
  const navigate = useNavigate();
  const location = useLocation();
  return (next: Locale) => {
    saveLocale(next);
    navigate(`${localizePath(location.pathname, next)}${location.search}${location.hash}`, { preventScrollReset: true, replace: true });
  };
}

/**
 * Globe + current code ("EN"), opening English / Türkçe / Türkmençe.
 * `placement="up"` for the footer; `variant="list"` renders plain buttons (mobile drawer).
 */
export function LanguageSwitcher({
  className,
  placement = "down",
  variant = "menu",
}: {
  className?: string;
  placement?: "down" | "up";
  variant?: "menu" | "list";
}) {
  const locale = useLocale();
  const t = useT("language");
  const switchTo = useSwitchLocale();
  const [open, setOpen] = useState(false);

  if (variant === "list") {
    return (
      <div className={className} role="group" aria-label={t("label")}>
        <p className="mb-2 flex items-center gap-2 text-xs text-navy/70">
          <Globe className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {t("label")}
        </p>
        <div className="flex flex-wrap gap-2">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={l === locale}
              onClick={() => switchTo(l)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                l === locale ? "border-navy bg-navy text-cream" : "border-navy/20 text-navy hover:border-navy",
              )}
            >
              {localeNames[l]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger
        aria-label={t("change", { current: localeNames[locale] })}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium tracking-[0.04em] text-navy transition-colors hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-navy",
          className,
        )}
      >
        <Globe className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
        <span>{locale.toUpperCase()}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
      </Menu.Trigger>
      <AnimatePresence>
        {open && (
          <Menu.Portal forceMount>
            <Menu.Content forceMount asChild side={placement === "up" ? "top" : "bottom"} align="end" sideOffset={6} className="z-[70]">
              <motion.div
                initial={{ opacity: 0, y: placement === "up" ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: placement === "up" ? 4 : -4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="min-w-44 rounded-sm border border-navy/10 bg-cream p-1 text-navy shadow-pop outline-none"
              >
                <Menu.RadioGroup value={locale} onValueChange={(v) => switchTo(v as Locale)}>
                  {locales.map((l) => (
                    <Menu.RadioItem
                      key={l}
                      value={l}
                      lang={l}
                      className="flex cursor-pointer items-center justify-between gap-6 rounded-xs px-3 py-2 text-sm outline-none data-[highlighted]:bg-navy/5"
                    >
                      <span>{localeNames[l]}</span>
                      <span className="flex items-center gap-2 text-xs text-navy/50">
                        {l.toUpperCase()}
                        <Menu.ItemIndicator>
                          <Check className="size-3.5 text-navy" strokeWidth={2} aria-hidden="true" />
                        </Menu.ItemIndicator>
                      </span>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </motion.div>
            </Menu.Content>
          </Menu.Portal>
        )}
      </AnimatePresence>
    </Menu.Root>
  );
}
