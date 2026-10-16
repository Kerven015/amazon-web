import { translate } from "@/i18n";
import { Link } from "@/lib/router";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useGoHome } from "./home-link";

/** Serif wordmark. `tone="light"` is for dark surfaces (seller sidebar). */
export function Logo({
  className,
  tone = "dark",
  size = "md",
  href = "/",
}: {
  href?: string;
  className?: string;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}) {
  const home = useGoHome();
  const text = size === "lg" ? "text-4xl" : size === "sm" ? "text-2xl" : "text-[28px] sm:text-[32px]";
  return (
    <Link
      href={href}
      // The shop logo behaves like "Home": closes overlays, scrolls up when already home
      onClick={href === "/" ? home.onClick : undefined}
      aria-label={href === "/" ? translate("common.storeHome", { store: siteConfig.name }) : siteConfig.name}
      className={cn(
        "inline-flex items-baseline rounded-xs font-serif font-semibold leading-none tracking-[0.02em] transition-[font-size] duration-300 ease-calm",
        tone === "light" ? "text-ink-foreground" : "text-foreground",
        text,
        className,
      )}
    >
      {siteConfig.name}
      <span aria-hidden="true" className="ml-0.5 opacity-50">
        .
      </span>
    </Link>
  );
}
