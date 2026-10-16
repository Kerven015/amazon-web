import { EditorialImage } from "@/components/ui/editorial-image";
import { ArrowRight } from "lucide-react";
import { InView } from "@/components/motion-ui/in-view";
import { Button } from "@/components/ui/button";
import { openPanel } from "@/lib/store/ui";
import { useT } from "@/i18n";

/** Home-page entry point for the product finder quiz. */
export function QuizBanner() {
  const t = useT("quiz");
  return (
    <InView>
      <section aria-labelledby="quiz-banner-h" className="grid overflow-hidden rounded-sm bg-muted md:grid-cols-2">
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px]">
          <EditorialImage seed="vd-quiz-banner" width={1000} height={800} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-col items-start justify-center gap-4 px-6 py-12 sm:px-12 lg:px-16">
          <p className="eyebrow text-muted-foreground">{t("eyebrow")}</p>
          <h2 id="quiz-banner-h" className="text-4xl leading-tight sm:text-5xl">
            {t("bannerTitle")}
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">{t("bannerBody")}</p>
          <Button size="lg" className="mt-2" onClick={() => openPanel("quiz")}>
            {t("start")} <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    </InView>
  );
}
