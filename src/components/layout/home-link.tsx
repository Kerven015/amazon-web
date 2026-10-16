import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";
import { useT } from "@/i18n";
import { Link, usePathname } from "@/lib/router";
import { usePanels } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import { NavIcon } from "@/components/ui/nav-icon";

/** Fired so overlays that keep their own state (mega menu, filter drawer) close too. */
export const CLOSE_OVERLAYS_EVENT = "vendora:close-overlays";

export const isHomePath = (pathname: string) => pathname === "/" || pathname === "";

/**
 * Click handler for every "go home" link (nav Home, mobile Home row, logo).
 * - closes the search overlay, cart / wishlist drawers, quiz and mobile menu, plus
 *   the mega menu and filter drawer (via CLOSE_OVERLAYS_EVENT)
 * - on the home page already: smooth-scrolls to the top instead of navigating
 * - otherwise the <Link> navigates client-side to /{locale}; scroll jumps to the top first
 *   so the home page opens at the top
 */
export function useGoHome() {
  const pathname = usePathname();
  const closePanels = usePanels((s) => s.close);
  const reduce = useReducedMotion();
  const onHome = isHomePath(pathname);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // Let modified clicks (new tab, etc.) behave like normal links
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      closePanels();
      window.dispatchEvent(new Event(CLOSE_OVERLAYS_EVENT));
      if (onHome) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
        // Move focus to the page so keyboard users start from the top as well
        document.getElementById("main")?.focus({ preventScroll: true });
      } else {
        // The site scrolls smoothly (html { scroll-behavior: smooth }); jump instead so the
        // home page opens at the top rather than animating up after it renders
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [closePanels, onHome, reduce],
  );

  return { onClick, onHome };
}

const MotionLink = motion.create(Link);
const iconVariants = { rest: { y: 0 }, hover: { y: -1 } };

/**
 * "Home" — first item of the desktop main navigation. A plain link (no panel).
 * Between 1024 and 1179px only the house icon shows (label → tooltip + accessible name),
 * so longer Turkish/Turkmen labels never push the menu onto two lines.
 */
export function NavHomeLink({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const t = useT("header");
  const reduce = useReducedMotion();
  const { onClick, onHome } = useGoHome();
  const label = t("home");

  return (
    <MotionLink
      href="/"
      aria-current={onHome ? "page" : undefined}
      onClick={(e: React.MouseEvent) => {
        onNavigate?.();
        onClick(e);
      }}
      initial="rest"
      animate="rest"
      whileHover={reduce ? undefined : "hover"}
      className={cn(className, "group/home gap-1.5", onHome && "after:!opacity-100")}
    >
      <motion.span
        aria-hidden="true"
        className="inline-flex"
        variants={reduce ? undefined : iconVariants}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <NavIcon name="home" size={16} />
      </motion.span>
      <span className="max-[1179px]:sr-only">{label}</span>
      {/* Tooltip, only while the label is hidden */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 whitespace-nowrap rounded-xs bg-navy px-2 py-1 text-xs font-medium text-cream opacity-0 shadow-pop transition-opacity duration-150 group-hover/home:opacity-100 group-focus-visible/home:opacity-100 min-[1180px]:hidden"
      >
        {label}
      </span>
    </MotionLink>
  );
}
