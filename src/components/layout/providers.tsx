import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/lib/theme";
import { useEffect } from "react";
import { toast } from "sonner";
import { translate } from "@/i18n";
import { catalogAge, ensureCatalog, listProducts, onCatalogChange } from "@/lib/catalog";
import { Toaster } from "@/components/ui/toaster";
import { useCart } from "@/lib/store/cart";
import { useUi } from "@/lib/store/orders";
import { useAddressBook } from "@/lib/store/addresses";
import { loadSession } from "@/lib/session";
import { useRecentlyViewed, useWishlist } from "@/lib/store/wishlist";

/**
 * Drops bag, wishlist and recently-viewed entries whose product was deleted
 * or hidden in the admin, and tells the shopper if their bag changed.
 */
function pruneUnavailable() {
  if (!Number.isFinite(catalogAge())) return;
  const live = new Set(listProducts().map((p) => p.id));
  const cart = useCart.getState();
  const goneItems = cart.items.filter((i) => !live.has(i.productId));
  const goneSaved = cart.saved.filter((i) => !live.has(i.productId));
  if (goneItems.length || goneSaved.length) {
    useCart.setState({
      items: cart.items.filter((i) => live.has(i.productId)),
      saved: cart.saved.filter((i) => live.has(i.productId)),
    });
  }
  if (goneItems.length) {
    toast(goneItems.length === 1 ? translate("cart.unavailable") : translate("cart.unavailableMany", { count: goneItems.length }), {
      description: goneItems.map((i) => i.title).join(", "),
    });
  }
  const wish = useWishlist.getState().ids;
  if (wish.some((id) => !live.has(id))) useWishlist.setState({ ids: wish.filter((id) => live.has(id)) });
  const recent = useRecentlyViewed.getState().ids;
  if (recent.some((id) => !live.has(id))) useRecentlyViewed.setState({ ids: recent.filter((id) => live.has(id)) });
}

function StoreHydration() {
  useEffect(() => {
    // Stores use skipHydration; pull persisted state from localStorage once mounted.
    void Promise.all([
      useCart.persist.rehydrate(),
      useWishlist.persist.rehydrate(),
      useRecentlyViewed.persist.rehydrate(),
      useAddressBook.persist.rehydrate(),
      useUi.persist.rehydrate(),
    ]).then(() => {
      // Signed in? Then the bag, wishlist and addresses come from the account (lib/session.ts)
      void loadSession();
      // Once the catalogue is loaded, remove anything that no longer exists
      ensureCatalog().then(pruneUnavailable, () => {});
    });
    return onCatalogChange(pruneUnavailable);
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* reducedMotion="user" disables transform/layout animations when the OS asks for reduced motion */}
      <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
        <StoreHydration />
        {children}
        <Toaster />
      </MotionConfig>
    </ThemeProvider>
  );
}
