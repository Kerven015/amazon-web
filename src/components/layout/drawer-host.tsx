import { usePathname } from "@/lib/router";
import { useEffect } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { WishlistDrawer } from "@/components/cart/wishlist-drawer";
import { QuizModal } from "@/components/quiz/quiz-modal";
import { openPanel, usePanels } from "@/lib/store/ui";
import { MobileMenu } from "./mobile-menu";
import { NewsletterPopup } from "./newsletter";
import { SearchOverlay } from "./search-overlay";

/**
 * Mounts every global overlay once. Also turns any plain `<a href="#quiz">`
 * into a quiz trigger and closes overlays on navigation.
 */
export function DrawerHost() {
  const pathname = usePathname();
  const close = usePanels((s) => s.close);

  useEffect(() => close(), [pathname, close]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href="#quiz"]');
      if (a) {
        e.preventDefault();
        openPanel("quiz");
      }
    };
    document.addEventListener("click", onClick);
    if (window.location.hash === "#quiz") openPanel("quiz");
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <MobileMenu />
      <SearchOverlay />
      <CartDrawer />
      <WishlistDrawer />
      <QuizModal />
      <NewsletterPopup />
    </>
  );
}
