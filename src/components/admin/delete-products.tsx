import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { ApiError, adminApi } from "@/lib/admin-api";
import { refreshCatalog } from "@/lib/catalog";
import { translate, useT } from "@/i18n";
import { adminError } from "@/lib/admin-errors";
import type { ProductImage as Img } from "@/types";

/** What the dialog needs: id, English name and the main image. */
export type Deletable = { id: string; title: string; images: Img[] };

const UNDO_MS = 8000;

/**
 * Deletes products on the server, refreshes the catalogue (cards animate out),
 * and shows "Product deleted" with an Undo button for 8 seconds.
 */
export async function deleteWithUndo(products: Deletable[]) {
  const ids = products.map((p) => p.id);
  await adminApi.remove(ids);
  await refreshCatalog("admin");
  // Built outside React: translate() uses the active (admin) language
  const n = products.length;
  toast(translate("admin.delete.deleted", { count: n }), {
    description: n === 1 ? products[0].title : undefined,
    duration: UNDO_MS,
    action: {
      label: translate("admin.delete.undo"),
      onClick: async () => {
        try {
          await adminApi.restore(ids);
          await refreshCatalog("admin");
          toast.success(translate("admin.delete.restored", { count: n }));
        } catch (err) {
          toast.error(err instanceof ApiError ? adminError(err.message) : translate("admin.delete.restoreFailed"));
        }
      },
    },
  });
}

/** "Delete this product? This cannot be undone." — thumbnail, name, Cancel / red Delete. */
export function DeleteDialog({
  products,
  onOpenChange,
  onDeleted,
}: {
  products: Deletable[] | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (ids: string[]) => void;
}) {
  const t = useT("admin.delete");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const list = products ?? [];
  const one = list.length === 1 ? list[0] : null;

  const confirm = async () => {
    setBusy(true);
    try {
      await deleteWithUndo(list);
      onDeleted?.(list.map((p) => p.id));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? adminError(err.message) : t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={!!products} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#1a1714]/40 data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          // Safe default: Enter right after opening cancels instead of deleting
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          className="theme-cream fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-sm bg-surface p-6 shadow-pop outline-none data-[state=open]:animate-[fade-in_200ms_ease-out]">
          <div className="flex items-start gap-4">
            {one ? (
              <span className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-xs bg-cream">
                <ProductImage src={one.images[0]?.src ?? ""} alt="" sizes="76px" decorative iconClassName="size-4" />
              </span>
            ) : (
              <span className="flex shrink-0 -space-x-6">
                {list.slice(0, 3).map((p) => (
                  <span key={p.id} className="relative h-20 w-16 overflow-hidden rounded-xs border-2 border-surface bg-cream">
                    <ProductImage src={p.images[0]?.src ?? ""} alt="" sizes="64px" decorative iconClassName="size-3" />
                  </span>
                ))}
              </span>
            )}
            <div className="min-w-0">
              <Dialog.Title className="text-base font-medium">
                {one ? one.title : t("selected", { count: list.length })}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                {one ? t("confirmOne") : t("confirmMany", { count: list.length })}
              </Dialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button ref={cancelRef} variant="outline" disabled={busy}>{t("cancel")}</Button>
            </Dialog.Close>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {t("delete")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
