import * as Dialog from "@radix-ui/react-dialog";
import { Star, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/i18n";
import { useMyReviews } from "@/lib/store/my-reviews";
import { useProfile } from "@/lib/store/profile";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type Errors = Partial<Record<"rating" | "headline" | "text" | "name", string>>;

/** "Write a review": rating, title, text and name — saved on this device (lib/store/my-reviews.ts). */
export function ReviewDialog({ product, open, onOpenChange }: { product: Product; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT("reviews.form");
  const uid = useId();
  const add = useMyReviews((s) => s.add);
  const profileName = useProfile((s) => s.name);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [headline, setHeadline] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setHeadline("");
    setText("");
    setName(profileName ?? "");
    setErrors({});
  }, [open, profileName]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (!rating) errs.rating = t("errors.rating");
    if (!headline.trim()) errs.headline = t("errors.headline");
    if (text.trim().length < 10) errs.text = t("errors.text");
    if (!name.trim()) errs.name = t("errors.name");
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-form="${uid}"] [aria-invalid="true"]`)?.focus());
      return;
    }
    add({
      id: `mine-${Date.now().toString(36)}`,
      productId: product.id,
      author: name.trim(),
      rating,
      title: headline.trim(),
      body: text.trim(),
      date: new Date().toISOString().slice(0, 10),
      verified: false,
      helpful: 0,
    });
    toast.success(t("saved"));
    onOpenChange(false);
  };

  const errorId = (k: keyof Errors) => (errors[k] ? `${uid}-${k}-error` : undefined);
  const shown = hover || rating;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1a1714]/45 data-[state=open]:animate-[fade-in_250ms_ease-out]" />
        <Dialog.Content className="theme-cream fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-sm border bg-surface p-5 shadow-pop outline-none data-[state=open]:animate-[sheet-in-bottom_320ms_var(--ease-calm-curve)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sm sm:p-8 sm:data-[state=open]:animate-[fade-in_250ms_ease-out]">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-serif text-3xl">{t("title")}</Dialog.Title>
            <Dialog.Close aria-label={t("cancel")} className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted">
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t("intro", { product: product.title })}</Dialog.Description>

          <form noValidate onSubmit={submit} className="mt-6 space-y-5" data-form={uid}>
            <fieldset aria-describedby={errorId("rating")}>
              <legend className="text-sm font-medium">{t("rating")}</legend>
              <div className="mt-1.5 flex" role="radiogroup" aria-label={t("rating")} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="grid size-11 cursor-pointer place-items-center" onMouseEnter={() => setHover(n)}>
                    <input
                      type="radio"
                      name={`${uid}-rating`}
                      value={n}
                      checked={rating === n}
                      onChange={() => {
                        setRating(n);
                        setErrors((e) => ({ ...e, rating: undefined }));
                      }}
                      aria-invalid={errors.rating && n === 1 ? true : undefined}
                      className="peer sr-only"
                    />
                    <span className="sr-only">{t("stars", { count: n })}</span>
                    <Star
                      aria-hidden="true"
                      strokeWidth={1.4}
                      className={cn("size-7 rounded-xs transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy", n <= shown ? "fill-star text-star" : "text-muted-foreground")}
                    />
                  </label>
                ))}
              </div>
              {errors.rating && (
                <p id={errorId("rating")} className="mt-1 text-xs text-danger">
                  {errors.rating}
                </p>
              )}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-headline`}>{t("headline")}</Label>
              <Input id={`${uid}-headline`} value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} aria-invalid={errors.headline ? true : undefined} aria-describedby={errorId("headline")} />
              {errors.headline && <p id={errorId("headline")} className="text-xs text-danger">{errors.headline}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-text`}>{t("text")}</Label>
              <Textarea id={`${uid}-text`} value={text} maxLength={1000} rows={5} onChange={(e) => setText(e.target.value)} aria-invalid={errors.text ? true : undefined} aria-describedby={errorId("text")} className="aria-[invalid=true]:border-danger" />
              {errors.text && <p id={errorId("text")} className="text-xs text-danger">{errors.text}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-name`}>{t("name")}</Label>
              <Input id={`${uid}-name`} value={name} maxLength={40} autoComplete="name" onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? true : undefined} aria-describedby={errorId("name")} />
              {errors.name && <p id={errorId("name")} className="text-xs text-danger">{errors.name}</p>}
            </div>
            <p className="text-xs text-muted-foreground">{t("localNote")}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  {t("cancel")}
                </Button>
              </Dialog.Close>
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
