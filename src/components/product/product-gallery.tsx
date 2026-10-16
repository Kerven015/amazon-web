import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Carousel, CarouselContent, CarouselIndicator, CarouselItem } from "@/components/motion-ui/carousel";
import { cn } from "@/lib/utils";
import type { ProductImage as ProductImageData } from "@/types";
import { ProductImage } from "./product-image";
import { useT } from "@/i18n";

const FADE = { duration: 0.25, ease: [0.4, 0, 0.2, 1] } as const;

/**
 * Product gallery.
 * Desktop: vertical thumbnails on the left, 4:5 main image with a 250ms crossfade
 * (no hover zoom — the photo stays still), click to open the full-screen lightbox.
 * Mobile: full-width swipeable carousel with dots (tap opens the lightbox).
 * `badge` is shown top-left on the main image.
 */
export function ProductGallery({
  images,
  title,
  badge,
}: {
  images: ProductImageData[];
  title: string;
  badge?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const reduce = useReducedMotion();
  const t = useT("gallery");
  const current = images[Math.min(index, images.length - 1)] ?? images[0];

  // Back to the first image when the colour (and so the image set) changes.
  const first = images[0]?.src;
  useEffect(() => setIndex(0), [first]);

  return (
    <div>
      {/* Desktop / tablet */}
      <div className="hidden gap-4 md:flex">
        {images.length > 1 && (
          <ul className="flex w-[76px] shrink-0 flex-col gap-3" aria-label={t("images")}>
            {images.map((img, i) => (
              <li key={`${img.src}-${i}`}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t("showImage", { n: i + 1, total: images.length })}
                  aria-current={i === index}
                  className={cn(
                    "relative block aspect-[4/5] w-full overflow-hidden rounded-xs bg-cream transition-opacity duration-300",
                    i === index ? "opacity-100 ring-1 ring-navy ring-offset-2 ring-offset-background" : "opacity-60 hover:opacity-100",
                  )}
                >
                  <ProductImage src={img.src} alt={img.alt} blurDataURL={img.blurDataURL} sizes="76px" decorative iconClassName="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label={t("openFullScreen", { title })}
            className="group/photo relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-xs bg-cream"
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={`${current?.src}-${index}`}
                className="absolute inset-0"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
              >
                {current && (
                  <ProductImage
                    src={current.src}
                    alt={current.alt}
                    blurDataURL={current.blurDataURL}
                    priority={index === 0}
                    sizes="(min-width: 1024px) 52vw, 90vw"
                    iconClassName="size-10"
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <span className="pointer-events-none absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-surface/85 text-foreground opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100" aria-hidden="true">
              <Expand className="size-4" strokeWidth={1.5} />
            </span>
          </button>
          {badge && <div className="pointer-events-none absolute left-3 top-3 z-10">{badge}</div>}
        </div>
      </div>

      {/* Mobile */}
      <div className="relative -mx-4 overflow-hidden bg-cream sm:mx-0 sm:rounded-xs md:hidden">
        <Carousel index={index} onIndexChange={setIndex} label={t("imagesOf", { title })}>
          <CarouselContent transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            {images.map((img, i) => (
              <CarouselItem key={`${img.src}-${i}`} index={i}>
                <button type="button" onClick={() => setLightbox(true)} aria-label={t("openImage", { n: i + 1 })} className="relative block aspect-[4/5] w-full">
                  <ProductImage src={img.src} alt={img.alt} blurDataURL={img.blurDataURL} priority={i === 0} sizes="100vw" iconClassName="size-10" />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
          {images.length > 1 && (
            <CarouselIndicator className="bottom-4 [&>button]:size-1.5 [&>button]:bg-navy/30 [&>button[aria-current=true]]:bg-navy" />
          )}
        </Carousel>
        {badge && <div className="pointer-events-none absolute left-4 top-4 z-10">{badge}</div>}
      </div>

      <Lightbox open={lightbox} onOpenChange={setLightbox} images={images} index={index} onIndexChange={setIndex} title={title} />
    </div>
  );
}

/** Full-screen viewer: arrows, keyboard ←/→, swipe, Esc to close. */
function Lightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndexChange,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ProductImageData[];
  index: number;
  onIndexChange: (i: number) => void;
  title: string;
}) {
  const count = images.length;
  const dir = useRef(1);
  const t = useT("gallery");
  const go = useCallback(
    (step: number) => {
      if (count < 2) return;
      dir.current = step;
      onIndexChange((index + step + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const img = images[index];
  const arrow =
    "absolute top-1/2 z-10 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-navy shadow-card transition-colors hover:bg-surface";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-cream data-[state=open]:animate-[fade-in_250ms_ease-out]" />
        <Dialog.Content className="fixed inset-0 z-[90] flex flex-col text-navy outline-none data-[state=open]:animate-[fade-in_250ms_ease-out]">
          <Dialog.Title className="sr-only">{t("viewerTitle", { title })}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("viewerHelp")}</Dialog.Description>
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <p className="text-sm tabular-nums" aria-live="polite">
              {index + 1} / {count}
            </p>
            <Dialog.Close aria-label={t("closeViewer")} className="grid size-11 place-items-center rounded-full hover:bg-navy/5">
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-4 sm:px-20">
            <AnimatePresence initial={false} custom={dir.current} mode="popLayout">
              {img && (
                <motion.div
                  key={`${img.src}-${index}`}
                  custom={dir.current}
                  initial={{ opacity: 0, x: dir.current * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir.current * -60 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  drag={count > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
                    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
                  }}
                  className="relative aspect-[4/5] h-full max-h-full max-w-full touch-pan-y"
                >
                  <ProductImage src={img.src} alt={img.alt} blurDataURL={img.blurDataURL} sizes="100vw" iconClassName="size-12" className="object-contain" />
                </motion.div>
              )}
            </AnimatePresence>
            {count > 1 && (
              <>
                <button type="button" aria-label={t("previous")} onClick={() => go(-1)} className={cn(arrow, "left-3 sm:left-6")}>
                  <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </button>
                <button type="button" aria-label={t("next")} onClick={() => go(1)} className={cn(arrow, "right-3 sm:right-6")}>
                  <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {count > 1 && (
            <ul className="flex justify-center gap-2 pb-5" aria-label={t("choose")}>
              {images.map((m, i) => (
                <li key={`${m.src}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      dir.current = i > index ? 1 : -1;
                      onIndexChange(i);
                    }}
                    aria-label={t("image", { n: i + 1 })}
                    aria-current={i === index}
                    className={cn("relative block h-14 w-11 overflow-hidden rounded-xs bg-surface transition-opacity", i === index ? "opacity-100 ring-1 ring-navy ring-offset-2 ring-offset-cream" : "opacity-50 hover:opacity-100")}
                  >
                    <ProductImage src={m.src} alt="" sizes="44px" decorative iconClassName="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
