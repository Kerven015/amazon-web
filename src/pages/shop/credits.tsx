import { Link } from "@/lib/router";
import { PageTitle } from "@/components/layout/page-title";
import { useT } from "@/i18n";
import { Container } from "@/components/layout/container";
import creditsJson from "@/lib/mock-data/image-credits.json";

type ImageCredit = { productId: string; file: string; pexelsId: number; photographer: string; photographerUrl: string; pexelsUrl: string };
const imageCredits = creditsJson as ImageCredit[];

/** Every photographer whose Pexels photos appear on product pages (from image-credits.json). */
export default function CreditsPage() {
  const t = useT();
  const byPhotographer = new Map<string, { name: string; url: string; count: number }>();
  for (const c of imageCredits) {
    const key = c.photographerUrl || c.photographer;
    const entry = byPhotographer.get(key) ?? { name: c.photographer, url: c.photographerUrl, count: 0 };
    entry.count++;
    byPhotographer.set(key, entry);
  }
  const photographers = [...byPhotographer.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Container className="max-w-3xl py-14">
      <PageTitle title={t("credits.title")} />
      <nav aria-label={t("collection.breadcrumb")} className="text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">{t("common.home")}</Link> / <span className="text-foreground">{t("credits.title")}</span>
      </nav>
      <h1 className="mt-8 text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto sm:text-6xl">{t("credits.title")}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
        {t.rich("credits.intro", {
          pexels: (
            <a href="https://www.pexels.com" target="_blank" rel="noreferrer noopener" className="text-foreground underline underline-offset-4">
              Pexels
            </a>
          ),
        })}
      </p>

      {photographers.length === 0 ? (
        <p className="mt-10 rounded-sm bg-cream p-6 text-sm text-navy">
          {t.rich("credits.empty", { command: <code className="font-mono">npm run images:fetch</code> })}
        </p>
      ) : (
        <ul className="mt-10 divide-y border-y">
          {photographers.map((p) => (
            <li key={p.url || p.name} className="flex items-center justify-between gap-4 py-3.5 text-[15px]">
              <a href={p.url} target="_blank" rel="noreferrer noopener" className="underline-offset-4 hover:underline">
                {p.name}
                <span className="sr-only"> {t("credits.onPexels")}</span>
              </a>
              <span className="text-sm text-muted-foreground">
                {t("credits.photos", { count: p.count })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
