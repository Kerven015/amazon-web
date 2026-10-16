import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselIndicator, CarouselItem } from "@/components/motion-ui/carousel";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { EditorialImage } from "@/components/ui/editorial-image";
import { Link } from "@/lib/router";
import { useFinePointer } from "@/lib/hooks/use-media-query";

/** Slide text lives in messages (home.hero.{key}.*). */
const slides = [
  { key: "bath", href: "/collections/bath-towels", seed: "vd-hero-bath" },
  { key: "beach", href: "/collections/beach-towels", seed: "vd-hero-beach" },
  { key: "spa", href: "/collections/wellness-spa", seed: "vd-hero-spa" },
];

/** Full-bleed editorial hero with slow autoplay (paused on hover, focus, or reduced motion). */
export function HeroCarousel() {
  const t = useT("home.hero");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const reduce = useReducedMotion();
  // Swipe on touch screens; with a mouse, dragging would fight text selection and the button
  const finePointer = useFinePointer();
  const autoplay = !paused && !hovering && !reduce;

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [autoplay]);

  return (
    <div
      className="relative overflow-hidden bg-muted"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
    >
      <Carousel index={index} onIndexChange={setIndex} label={t("label")} disableDrag={finePointer}>
        <CarouselContent transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          {slides.map((s, i) => (
            <CarouselItem key={s.key} index={i}>
              <div className="relative h-[72svh] min-h-[460px] max-h-[760px]">
                <EditorialImage seed={s.seed} width={1800} height={1000} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" draggable={false} />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent sm:bg-linear-to-r sm:from-black/45 sm:via-black/10" />
                <div className="relative mx-auto flex h-full max-w-[1440px] items-end px-5 pb-16 sm:items-center sm:px-8 sm:pb-0 lg:px-12">
                  <div className="max-w-lg text-white">
                    <p className="eyebrow text-white/85">{t(`${s.key}.eyebrow`)}</p>
                    <h2 className="mt-3 text-balance text-4xl leading-[1.04] [overflow-wrap:anywhere] hyphens-auto sm:text-6xl lg:text-7xl">{t(`${s.key}.title`)}</h2>
                    <p className="mt-4 max-w-sm text-[15px] text-white/90">{t(`${s.key}.body`)}</p>
                    <Button asChild size="lg" className="mt-7 bg-white text-[#2b3b63] hover:bg-white/90">
                      <Link href={s.href}>{t(`${s.key}.cta`)}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselIndicator className="bottom-6" />
      </Carousel>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? t("play") : t("pause")}
        className="absolute bottom-4 right-4 grid size-9 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/40"
      >
        {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}
