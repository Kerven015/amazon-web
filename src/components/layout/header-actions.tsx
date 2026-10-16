import { Heart, Monitor, Moon, Search, ShoppingBag, Sun, User } from "lucide-react";
import { Link } from "@/lib/router";
import { useTheme } from "@/lib/theme";
import { SlidingNumber } from "@/components/motion-ui/sliding-number";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMounted } from "@/lib/hooks/use-mounted";
import { selectCount, useCart } from "@/lib/store/cart";
import { openPanel } from "@/lib/store/ui";
import { useWishlist } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export const iconBtn =
  "relative grid size-10 place-items-center rounded-full text-navy transition-colors duration-150 hover:bg-navy/[0.06]";

const stroke = 1.5;

export function SearchButton() {
  const t = useT("header");
  return (
    <button type="button" aria-label={t("search")} aria-haspopup="dialog" onClick={() => openPanel("search")} className={iconBtn}>
      <Search className="size-5" strokeWidth={stroke} aria-hidden="true" />
    </button>
  );
}

export function AccountLink() {
  const t = useT("header");
  return (
    <Link href="/login" className={cn(iconBtn, "w-auto gap-2 px-2.5 xl:rounded-sm")} aria-label={t("accountLabel")}>
      <User className="size-5" strokeWidth={stroke} aria-hidden="true" />
      <span className="hidden whitespace-nowrap text-[13px] font-medium xl:inline">{t("logIn")}</span>
    </Link>
  );
}

export function WishlistButton() {
  const t = useT("header");
  const count = useWishlist((s) => s.ids.length);
  const mounted = useMounted();
  const n = mounted ? count : 0;
  return (
    <button
      type="button"
      aria-label={t("wishlistLabel", { count: n })}
      aria-haspopup="dialog"
      onClick={() => openPanel("wishlist")}
      className={iconBtn}
    >
      <Heart className="size-5" strokeWidth={stroke} aria-hidden="true" />
      {/* Same count badge as the bag */}
      <span
        aria-hidden="true"
        data-testid="wishlist-count"
        className={cn(
          "absolute -right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-navy px-1 text-[10px] font-semibold text-cream transition-[transform,opacity] duration-300",
          n === 0 && "scale-50 opacity-0",
        )}
      >
        <SlidingNumber value={n} />
      </span>
    </button>
  );
}

export function BagButton() {
  const t = useT("header");
  const count = useCart(selectCount);
  const mounted = useMounted();
  const n = mounted ? count : 0;
  return (
    <button
      type="button"
      aria-label={t("bagLabel", { count: n })}
      aria-haspopup="dialog"
      onClick={() => openPanel("cart")}
      className={iconBtn}
    >
      <ShoppingBag className="size-5" strokeWidth={stroke} aria-hidden="true" />
      <span
        aria-hidden="true"
        className={cn(
          "absolute -right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-navy px-1 text-[10px] font-semibold text-cream transition-[transform,opacity] duration-300",
          n === 0 && "scale-50 opacity-0",
        )}
      >
        <SlidingNumber value={n} />
      </span>
    </button>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useT("header.theme");
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const Icon = !mounted ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t("change")} className={cn(iconBtn, className)}>
        <Icon className="size-[18px]" strokeWidth={stroke} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? theme : "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{t("light")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t("dark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t("system")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
