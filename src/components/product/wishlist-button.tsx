import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useMounted } from "@/lib/hooks/use-mounted";
import { openPanel } from "@/lib/store/ui";
import { useWishlist } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

const HINT_KEY = "vendora-wishlist-hinted";
/** True after the first save in this browser (and remembers it). */
function hinted() {
  try {
    if (localStorage.getItem(HINT_KEY)) return true;
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* storage blocked: show the toast */
  }
  return false;
}

export function WishlistButton({
  productId,
  title,
  className,
  variant = "floating",
}: {
  productId: string;
  title: string;
  className?: string;
  variant?: "floating" | "inline" | "text";
}) {
  const mounted = useMounted();
  const isSaved = useWishlist((s) => s.ids.includes(productId));
  const saved = mounted && isSaved;
  const toggle = useWishlist((s) => s.toggle);
  const t = useT("wishlist");

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t("removeNamed", { title }) : t("saveNamed", { title })}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toggle(productId);
        // The filled heart (and the header count) are the feedback; only the very first save
        // gets a toast, to show where saved items live.
        if (now && !hinted()) {
          toast(t("saved"), { description: title, action: { label: t("view"), onClick: () => openPanel("wishlist") } });
        }
      }}
      className={cn(
        "transition-colors duration-200",
        variant === "floating"
          ? "grid size-9 place-items-center rounded-full bg-surface/80 backdrop-blur-sm hover:bg-surface"
          : variant === "text"
            ? "inline-flex items-center gap-2 py-1 text-sm underline-offset-4 hover:underline"
            : "inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-foreground/80 px-4 text-[13px] font-medium tracking-[0.04em] hover:bg-muted",
        className,
      )}
    >
      <Heart
        className={cn("size-[18px] transition-[fill,color] duration-300", saved ? "fill-navy text-navy" : "text-foreground")}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      {variant === "inline" && (saved ? t("savedShort") : t("add"))}
      {variant === "text" && (saved ? t("added") : t("add"))}
    </button>
  );
}
