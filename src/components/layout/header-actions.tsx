import { Heart, LogOut, Monitor, Moon, Package, Search, ShoppingBag, Sun, User } from "lucide-react";
import { Link, useRouter } from "@/lib/router";
import { useTheme } from "@/lib/theme";
import { SlidingNumber } from "@/components/motion-ui/sliding-number";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMounted } from "@/lib/hooks/use-mounted";
import { selectCount, useCart } from "@/lib/store/cart";
import { openPanel } from "@/lib/store/ui";
import { useWishlist } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { firstName, signOut, useSession } from "@/lib/session";

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

/** Signed out: "Log in". Signed in: the customer's first name with a menu (account, orders, sign out). */
export function AccountLink() {
  const t = useT("header");
  const user = useSession((s) => s.user);
  const router = useRouter();
  const cls = cn(iconBtn, "w-auto gap-2 px-2.5 xl:rounded-sm");

  if (!user) {
    return (
      <Link href="/login" className={cls} aria-label={t("accountLabel")}>
        <User className="size-5" strokeWidth={stroke} aria-hidden="true" />
        <span className="hidden whitespace-nowrap text-[13px] font-medium xl:inline">{t("logIn")}</span>
      </Link>
    );
  }

  const leave = async () => {
    await signOut().catch(() => {});
    toast(t("signedOut"));
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cls} aria-label={t("accountMenu", { name: user.name })}>
        <User className="size-5" strokeWidth={stroke} aria-hidden="true" />
        <span className="hidden max-w-32 truncate whitespace-nowrap text-[13px] font-medium xl:inline">{firstName(user.name)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-64 truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User aria-hidden="true" /> {t("yourAccount")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account?tab=orders">
            <Package aria-hidden="true" /> {t("yourOrders")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={leave}>
          <LogOut aria-hidden="true" /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WishlistButton() {
  const t = useT("header");
  const count = useWishlist((s) => s.ids.length);
  const signedIn = useSession((s) => s.status === "signedIn");
  const mounted = useMounted();
  const n = mounted && signedIn ? count : 0;
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
