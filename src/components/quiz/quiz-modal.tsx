import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { Link } from "@/lib/router";
import { useMemo, useState } from "react";
import { TransitionPanel } from "@/components/motion-ui/transition-panel";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/lib/catalog";
import { colorFamilies, familySwatches } from "@/lib/product-utils";
import { usePanels } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import type { ColorFamily, Feel, Product } from "@/types";
import { useT } from "@/i18n";

/** Texts: messages → quiz.useCases / quiz.feels. Each use case matches product types or collections. */
const useCases: { id: string; types: string[]; collections?: string[]; href: string }[] = [
  { id: "everyday", types: ["Bath Towels", "Towel Bundles"], href: "/collections/bath-towels" },
  { id: "spa", types: ["Bathrobes"], collections: ["wellness-spa", "luxury"], href: "/collections/wellness-spa" },
  { id: "beach", types: ["Beach Towels"], collections: ["quick-drying"], href: "/collections/beach-towels" },
  { id: "baby", types: ["Baby Towels"], href: "/collections/baby-towels" },
  { id: "kitchen", types: ["Kitchen Towels"], href: "/collections/kitchen-towels" },
  { id: "gift", types: ["Towel Bundles"], collections: ["luxury"], href: "/collections/gifting" },
];

const feels: Feel[] = ["Light & airy", "Soft & cosy", "Plush & indulgent", "Crisp & structured", "Smooth & sleek"];

const families = Object.keys(familySwatches) as ColorFamily[];

const fits = (p: Product, u: (typeof useCases)[number]) =>
  u.types.includes(p.productType) || !!u.collections?.some((c) => p.collections?.includes(c)) || (u.id === "gift" && !!p.personalisable);

/** 3-step product finder (use case → feel → colour) over the mock catalogue. */
export function QuizModal() {
  const open = usePanels((s) => s.open === "quiz");
  const close = usePanels((s) => s.close);
  const t = useT("quiz");
  const tFeels = useT("feels");
  const tFamilies = useT("colourFamilies");
  const tf = (f: Feel) => tFeels(f);
  const STEPS = [t("steps.useCase"), t("steps.feel"), t("steps.colour")];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [useCase, setUseCase] = useState<string | null>(null);
  const [feel, setFeel] = useState<Feel | null>(null);
  const [colour, setColour] = useState<ColorFamily | "any" | null>(null);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const reset = () => {
    setStep(0);
    setUseCase(null);
    setFeel(null);
    setColour(null);
  };

  const matches = useMemo(() => {
    const u = useCases.find((x) => x.id === useCase);
    return listProducts()
      .filter((p) => p.stock > 0)
      .map((p) => {
        let score = 0;
        if (u && fits(p, u)) score += 3;
        if (feel && p.feel === feel) score += 2;
        if (colour && colour !== "any" && colorFamilies(p).includes(colour)) score += 2;
        return { p, score: score + p.rating / 10 };
      })
      .filter((m) => m.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((m) => m.p);
  }, [useCase, feel, colour]);

  const seeAll = (() => {
    const params = new URLSearchParams();
    if (feel) params.set("feel", feel);
    if (colour && colour !== "any") params.set("colour", colour);
    const u = useCases.find((x) => x.id === useCase);
    return `${u?.href ?? "/collections/all-towels"}${params.toString() ? `?${params}` : ""}`;
  })();

  const option = (selected: boolean) =>
    cn(
      "flex w-full items-center gap-4 rounded-sm border px-4 py-3.5 text-left transition-colors duration-300 ease-calm",
      selected ? "border-foreground bg-primary-soft" : "hover:border-foreground/60",
    );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          close();
          setTimeout(reset, 300);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1a1714]/45 data-[state=open]:animate-[fade-in_300ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-sm bg-surface shadow-pop outline-none data-[state=open]:animate-[fade-in_300ms_ease-out]">
          <div className="flex items-center justify-between border-b px-5 py-3 sm:px-7">
            {step > 0 ? (
              <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 text-sm">
                <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("back")}
              </button>
            ) : (
              <span className="eyebrow text-muted-foreground">{t("eyebrow")}</span>
            )}
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {step < 3 ? t("stepOf", { n: step + 1, total: 3 }) : t("yourMatches")}
            </span>
            <Dialog.Close aria-label={t("close")} className="grid size-9 place-items-center rounded-full hover:bg-muted">
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="h-px bg-border" aria-hidden="true">
            <div className="h-px bg-foreground transition-[width] duration-500 ease-calm" style={{ width: `${(Math.min(step, 3) / 3) * 100}%` }} />
          </div>

          <div className="overflow-y-auto px-5 py-7 sm:px-8">
            <Dialog.Title className="text-center font-serif text-3xl sm:text-4xl">
              {step < 3 ? STEPS[step] : t("resultsTitle")}
            </Dialog.Title>
            <Dialog.Description className="mx-auto mt-2 max-w-sm text-center text-sm text-muted-foreground">
              {step < 3 ? t("intro") : t("resultsIntro")}
            </Dialog.Description>

            <TransitionPanel activeIndex={step} direction={dir} className="mt-7" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <ul className="space-y-2.5">
                {useCases.map((u) => (
                  <li key={u.id}>
                    <button type="button" aria-pressed={useCase === u.id} onClick={() => { setUseCase(u.id); go(1); }} className={option(useCase === u.id)}>
                      <span>
                        <span className="block font-medium">{t(`useCases.${u.id}.label`)}</span>
                        <span className="block text-sm text-muted-foreground">{t(`useCases.${u.id}.note`)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <ul className="space-y-2.5">
                {feels.map((f) => (
                  <li key={f}>
                    <button type="button" aria-pressed={feel === f} onClick={() => { setFeel(f); go(2); }} className={option(feel === f)}>
                      <span>
                        <span className="block font-medium">{tf(f)}</span>
                        <span className="block text-sm text-muted-foreground">{t(`feelNotes.${f}`)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div>
                <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5">
                  {families.map((f) => (
                    <li key={f}>
                      <button
                        type="button"
                        aria-pressed={colour === f}
                        onClick={() => { setColour(f); go(3); }}
                        className="flex w-full flex-col items-center gap-2 text-sm"
                      >
                        <span
                          className={cn(
                            "size-12 rounded-full border border-black/10 ring-offset-2 ring-offset-surface transition-shadow",
                            colour === f && "ring-1 ring-foreground",
                          )}
                          style={{ background: familySwatches[f] }}
                        />
                        {tFamilies(f)}
                      </button>
                    </li>
                  ))}
                  {/* "No preference" is a tile like the colours: a swatch made of every colour */}
                  <li>
                    <button
                      type="button"
                      aria-pressed={colour === "any"}
                      onClick={() => { setColour("any"); go(3); }}
                      className="flex w-full flex-col items-center gap-2 text-sm"
                    >
                      <span
                        className={cn(
                          "size-12 rounded-full border border-black/10 ring-offset-2 ring-offset-surface transition-shadow",
                          colour === "any" && "ring-1 ring-foreground",
                        )}
                        style={{ background: `conic-gradient(${families.map((f) => familySwatches[f]).join(", ")}, ${familySwatches[families[0]]})` }}
                      />
                      {t("noPreference")}
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                {matches.length ? (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
                    {matches.map((p) => (
                      <li key={p.id} onClickCapture={(e) => (e.target as HTMLElement).closest("a") && close()}>
                        <ProductCard product={p} size="compact" sizes="160px" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">{t("noMatches")}</p>
                )}
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Button asChild size="lg">
                    <Link href={seeAll} onClick={close}>
                      {t("seeAll")}
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    {t("startAgain")}
                  </Button>
                </div>
              </div>
            </TransitionPanel>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
