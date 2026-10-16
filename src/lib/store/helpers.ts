import { translate } from "@/i18n";
import { sellers } from "@/lib/mock-data/sellers";

/** Synchronous lookup used when snapshotting a product into the cart. */
export function getSellerName(sellerId: string) {
  return sellers.find((s) => s.id === sellerId)?.name ?? translate("common.marketplaceSeller");
}
