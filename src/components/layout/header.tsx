import { Menu } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openPanel } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import { AnnouncementBar } from "./announcement-bar";
import { AccountLink, BagButton, iconBtn, SearchButton, ThemeToggle, WishlistButton } from "./header-actions";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { useT } from "@/i18n";
import { MegaMenu } from "./mega-menu";

/**
 * Announcement bar scrolls away; the header row below it is sticky and
 * tightens slightly once the page is scrolled. When the menu needs its own
 * row (long TR/TK/RU labels at 1024–1280px), that row folds away while
 * scrolling down and comes back on scroll up, so the sticky header stays slim.
 */
export function Header() {
  const t = useT("header");
  const [scrolled, setScrolled] = useState(false);
  const [scrollingDown, setScrollingDown] = useState(false);
  const [navFocused, setNavFocused] = useState(false);

  // Folding the menu row changes the page height above the content, and the browser's
  // scroll anchoring then nudges scrollY. Those nudges are not the shopper scrolling, so
  // they're ignored for a moment after each fold (otherwise the row would flip-flop).
  const lastY = useRef(0);
  const lockUntil = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      if (performance.now() < lockUntil.current) {
        lastY.current = y;
        return;
      }
      if (Math.abs(y - lastY.current) < 8) return;
      setScrollingDown(y > lastY.current && y > 160);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const stacked = useStackedNav(scrollingDown && !navFocused);
  const collapsed = stacked.on && scrollingDown && !navFocused;
  useEffect(() => {
    lockUntil.current = performance.now() + 450;
  }, [collapsed, scrolled]);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[70] rounded-sm bg-surface px-3 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t("skipToContent")}
      </a>
      <AnnouncementBar />
      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ease-calm",
          scrolled ? "border-navy/10 bg-cream/95 text-navy backdrop-blur-md" : "border-transparent bg-cream text-navy",
        )}
      >
        <div
          ref={stacked.rowRef}
          className={cn(
            "mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 transition-[height] duration-300 ease-calm sm:px-5 lg:flex lg:gap-6 lg:px-8 min-[1180px]:gap-8",
            scrolled ? "h-14 lg:h-16" : "h-16 lg:h-20",
          )}
        >
          {/* Mobile: menu + search on the left */}
          <div className="flex items-center lg:hidden">
            <button type="button" aria-label={t("openMenu")} aria-haspopup="dialog" onClick={() => openPanel("menu")} className={iconBtn}>
              <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <SearchButton />
          </div>

          <div ref={stacked.logoRef} className="justify-self-center lg:justify-self-auto">
            <Logo className={cn("text-navy", scrolled ? "text-[24px] sm:text-[26px]" : "")} />
          </div>

          {/* One row when the menu fits next to the logo and icons; otherwise its own row below */}
          {!stacked.on && <MegaMenu navRef={stacked.navRef} className="hidden min-w-0 flex-1 justify-center lg:flex" />}
          {stacked.on && <div className="hidden flex-1 lg:block" />}

          <div ref={stacked.actionsRef} className="flex items-center justify-end gap-0.5">
            <span className="hidden lg:contents">
              <SearchButton />
            </span>
            <LanguageSwitcher className="hidden md:inline-flex" />
            <span className="hidden sm:contents">
              <AccountLink />
            </span>
            <WishlistButton />
            <BagButton />
            <ThemeToggle className="hidden xl:grid" />
          </div>
        </div>
        {stacked.on && (
          <div
            data-testid="stacked-nav"
            data-collapsed={collapsed}
            onFocusCapture={() => setNavFocused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setNavFocused(false);
            }}
            className={cn(
              "hidden transition-[grid-template-rows,border-color] duration-300 ease-calm lg:grid",
              collapsed ? "grid-rows-[0fr] border-t border-transparent" : "grid-rows-[1fr] border-t border-navy/10",
            )}
          >
            <div className="min-h-0 overflow-hidden" inert={collapsed ? true : undefined}>
              <MegaMenu navRef={stacked.navRef} className="mx-auto flex h-12 max-w-[1440px] items-center justify-center px-8" />
            </div>
          </div>
        )}
      </header>
    </>
  );
}

/**
 * Whether the desktop menu needs its own row. Compares the menu's natural width
 * with the space left between the logo and the icons; re-checks on resize, language
 * change (labels change width) and when the header tightens on scroll.
 * Also tells the sticky collection toolbar how tall the header is.
 */
function useStackedNav(collapsed = false) {
  const rowRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const [on, setOn] = useState(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const check = () => {
      const ul = navRef.current;
      if (!ul || window.innerWidth < 1024) return setOn(false);
      const cs = getComputedStyle(row);
      const gap = parseFloat(cs.columnGap) || 0;
      const free =
        row.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight) -
        (logoRef.current?.offsetWidth ?? 0) -
        (actionsRef.current?.offsetWidth ?? 0) -
        gap * 2;
      setOn(ul.scrollWidth > free);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(row);
    if (logoRef.current) ro.observe(logoRef.current);
    if (actionsRef.current) ro.observe(actionsRef.current);
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [on]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (on) root.setProperty("--toolbar-top-lg", collapsed ? "4.125rem" : "7.125rem");
    else root.removeProperty("--toolbar-top-lg");
    return () => root.removeProperty("--toolbar-top-lg");
  }, [on, collapsed]);

  return { rowRef, logoRef, actionsRef, navRef, on };
}
