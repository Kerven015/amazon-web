import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "@/lib/router";
import { usePathname } from "@/lib/router";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPriceShort, useT } from "@/i18n";
import { mainNav, type NavGroup, type NavItem, type NavLink } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NavIcon } from "@/components/ui/nav-icon";
import { CLOSE_OVERLAYS_EVENT, NavHomeLink } from "./home-link";

/**
 * Lets the admin reuse this exact menu: it maps every public href
 * (e.g. /collections/bath-towels → /admin/collections/bath-towels).
 * Returning null hides that link.
 */
type HrefMapper = (href: string) => string | null;
const NavHrefContext = createContext<HrefMapper>((href) => href);
export const NavHrefProvider = NavHrefContext.Provider;
export const useNavHref = () => useContext(NavHrefContext);

/** Translated menu labels (messages → megaMenu). Icons come from lib/navigation.ts. */
export function useNavText() {
  const t = useT("megaMenu");
  return {
    item: (i: NavItem) => t(`items.${i.id}`),
    group: (g: NavGroup) => t(`groups.${g.key}`),
    link: (l: NavLink) => {
      const under = l.key.match(/^under(\d+)$/);
      return under ? t("links.under", { amount: formatPriceShort(Number(under[1])) }) : t(`links.${l.key}`);
    },
  };
}

const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

const MotionLink = motion.create(Link);

/** Small playful tilt on the icon when its row is hovered or focused. */
const iconVariants = {
  rest: { scale: 1, rotate: 0 },
  hover: { scale: 1.15, rotate: -6 },
};

/**
 * One panel row: [icon][label] inside a single <a>, so the whole row is clickable.
 * The underline applies to the label only (see .mega-label in globals.css).
 */
export function MegaLink({ link, onNavigate }: { link: NavLink; onNavigate?: () => void }) {
  const reduce = useReducedMotion();
  const href = useNavHref()(link.href);
  const text = useNavText();
  if (!href) return null;
  return (
    <MotionLink
      href={href}
      onClick={onNavigate}
      className="mega-link"
      initial="rest"
      animate="rest"
      whileHover={reduce ? undefined : "hover"}
      whileFocus={reduce ? undefined : "hover"}
    >
      {link.icon && (
        <motion.span
          aria-hidden="true"
          className="mega-icon"
          variants={reduce ? undefined : iconVariants}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <NavIcon name={link.icon} size={16} />
        </motion.span>
      )}
      <span className="mega-label">{text.link(link)}</span>
    </MotionLink>
  );
}

/**
 * Desktop main navigation with full-width cream panels.
 * - Hover opens after 120ms and closes 200ms after leaving (no flicker).
 * - Click, Enter/Space toggle; ArrowDown opens and moves focus into the panel.
 * - Esc, outside click (overlay), focus leaving and route change all close it.
 * Panel layout/typography live in globals.css (.mega-*) so they match the spec exactly.
 */
export function MegaMenu({ className, navRef }: { className?: string; navRef?: React.RefObject<HTMLUListElement | null> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [overlayTop, setOverlayTop] = useState(0);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const panels = useRef<Record<string, HTMLDivElement | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const baseId = useId();
  const mapHref = useNavHref();
  const text = useNavText();
  const t = useT("header");

  useEffect(() => setMounted(true), []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const open = useCallback((id: string) => {
    clearTimer();
    // Overlay starts at the bottom edge of the sticky header
    const header = rootRef.current?.closest("header");
    if (header) setOverlayTop(header.getBoundingClientRect().bottom);
    setOpenId(id);
  }, []);
  const close = useCallback(() => {
    clearTimer();
    setOpenId(null);
  }, []);
  const openSoon = (id: string) => {
    clearTimer();
    timer.current = setTimeout(() => open(id), openId ? 0 : OPEN_DELAY);
  };
  const closeSoon = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpenId(null), CLOSE_DELAY);
  };

  // Close on route change and clean up timers
  useEffect(() => close(), [pathname, close]);
  useEffect(() => () => clearTimer(), []);
  // "Home" (and the logo) close the panel even when the path doesn't change
  useEffect(() => {
    window.addEventListener(CLOSE_OVERLAYS_EVENT, close);
    return () => window.removeEventListener(CLOSE_OVERLAYS_EVENT, close);
  }, [close]);

  // Clicking anywhere outside the nav (including the overlay) closes it
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openId, close]);

  // Esc closes and returns focus to the trigger
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const id = openId;
      close();
      triggers.current[id]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, close]);

  const focusFirstLink = (id: string) =>
    requestAnimationFrame(() => panels.current[id]?.querySelector<HTMLElement>("a, button")?.focus());

  const onTriggerKeyDown = (e: React.KeyboardEvent, item: NavItem) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      open(item.id);
      focusFirstLink(item.id);
    }
  };

  return (
    <div
      ref={rootRef}
      className={className}
      onMouseLeave={closeSoon}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <nav aria-label={t("mainNav")}>
        <ul ref={navRef} className="flex w-max items-center gap-4 min-[1180px]:gap-7 xl:gap-9">
          {/* Home: plain link, first; hidden where the menu is reused with other URLs (admin) */}
          {mapHref("/") === "/" && (
            <li onMouseEnter={closeSoon}>
              <NavHomeLink
                onNavigate={close}
                className={cn(
                  "relative inline-flex h-10 items-center whitespace-nowrap rounded-xs text-[15px] font-medium tracking-[-0.005em] text-navy transition-colors duration-150",
                  "after:absolute after:inset-x-0 after:bottom-1.5 after:h-px after:bg-navy after:opacity-0 after:transition-opacity after:duration-150 hover:after:opacity-100",
                )}
              />
            </li>
          )}
          {mainNav.map((item) => {
            const isOpen = openId === item.id;
            const itemClass = cn(
              "relative inline-flex h-10 items-center whitespace-nowrap rounded-xs text-[15px] font-medium tracking-[-0.005em] text-navy transition-colors duration-150",
              "after:absolute after:inset-x-0 after:bottom-1.5 after:h-px after:bg-navy after:transition-opacity after:duration-150",
              isOpen ? "after:opacity-100" : "after:opacity-0 hover:after:opacity-100",
            );

            if (!item.groups) {
              const href = mapHref(item.href);
              if (!href) return null;
              return (
                <li key={item.id} onMouseEnter={closeSoon}>
                  <Link href={href} className={itemClass}>
                    {text.item(item)}
                  </Link>
                </li>
              );
            }

            const panelId = `${baseId}-${item.id}`;
            return (
              <li key={item.id} onMouseEnter={() => openSoon(item.id)}>
                <button
                  type="button"
                  ref={(el) => {
                    triggers.current[item.id] = el;
                  }}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => (isOpen ? close() : open(item.id))}
                  onKeyDown={(e) => onTriggerKeyDown(e, item)}
                  className={itemClass}
                >
                  {text.item(item)}
                </button>

                {/* Panel sits right after its trigger in the DOM so Tab order flows into it. */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      ref={(el: HTMLDivElement | null) => {
                        panels.current[item.id] = el;
                      }}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      onMouseEnter={clearTimer}
                      className="mega-panel absolute inset-x-0 top-full z-40"
                    >
                      <div className="mega-inner">
                        {item.groups.map((group) => (
                          <section key={group.heading} aria-labelledby={`${panelId}-${group.key}`}>
                            <h3 id={`${panelId}-${group.key}`} className="mega-heading">
                              {text.group(group)}
                            </h3>
                            <ul className="mega-list">
                              {group.links.map((link) => (
                                <li key={`${group.key}-${link.key}`}>
                                  <MegaLink link={link} onNavigate={close} />
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Dim overlay below the header; clicking it closes the panel */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {openId && (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={close}
                onMouseEnter={closeSoon}
                className="fixed inset-x-0 bottom-0 z-30 bg-black/15"
                style={{ top: overlayTop }}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
