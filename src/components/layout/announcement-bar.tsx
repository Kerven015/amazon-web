import { useState } from "react";
import { TextLoop } from "@/components/motion-ui/text-loop";
import { formatPriceShort, useLocale, useT } from "@/i18n";
import { announcements, siteConfig } from "@/lib/config";
import { MenuAnchor } from "./menu-anchor";

/** True while we deliver to the US only — shoppers reading another language get told up front. */
export function useUsOnlyNotice() {
  const locale = useLocale();
  return locale !== "en" && siteConfig.shippingCountries.length === 1 && siteConfig.shippingCountries[0] === "US";
}

/**
 * Thin full-width message bar above the header; rotates gently with Text Loop.
 * Pauses while hovered or while something inside it has keyboard focus.
 */
export function AnnouncementBar() {
  const t = useT("header.announcements");
  const ts = useT("shipping");
  const usOnly = useUsOnlyNotice();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const items = announcements.map((a) => (
    <span key={a.key} className="inline-flex flex-wrap items-center justify-center gap-x-2">
      <span>{t(`${a.key}.text`, { amount: formatPriceShort(siteConfig.freeShippingThreshold) })}</span>
      <span aria-hidden="true" className="opacity-50">
        |
      </span>
      <MenuAnchor link={a} className="underline decoration-1 underline-offset-[3px] hover:opacity-80">
        {t(`${a.key}.link`)}
      </MenuAnchor>
    </span>
  ));
  if (usOnly) {
    items.unshift(
      <span key="us-only" data-testid="us-only-notice">
        {ts("usOnly")}
      </span>,
    );
  }

  return (
    <div
      className="border-b border-navy/[0.06] bg-cream text-navy"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-center px-4 text-center text-[13px]" aria-live="off">
        <TextLoop
          interval={5}
          trigger={!hovered && !focused}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          variants={{
            initial: { y: 8, opacity: 0 },
            animate: { y: 0, opacity: 1 },
            exit: { y: -8, opacity: 0 },
          }}
        >
          {items}
        </TextLoop>
      </div>
    </div>
  );
}
