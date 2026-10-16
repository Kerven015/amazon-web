import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { Link } from "@/lib/router";
import { notFound } from "@/lib/router";
import { PageTitle } from "@/components/layout/page-title";
import { Container } from "@/components/layout/container";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/motion-ui/accordion";
import { formatPrice, formatPriceShort, getActiveLocale, messageValue, useLocale, useT } from "@/i18n";
import { formatMessage } from "@/i18n/icu";
import { siteConfig } from "@/lib/config";
import { deliveryDays, deliveryPrice } from "@/lib/delivery";

/** Help topics live in messages/{en,tr,tk}.json → help.topics.{topic} (TODO(backend): move to a CMS). */
const TOPICS = ["delivery", "returns", "size-guide", "care", "buying-guide", "contact", "about", "journal", "terms", "privacy", "cookies"];

type Topic = { title: string; intro: string; sections?: { q: string; a: string }[] };

export function helpLoader({ params }: LoaderFunctionArgs) {
  const topic = params.topic ?? "";
  if (!TOPICS.includes(topic)) notFound();
  return { topic, locale: getActiveLocale() };
}

/** /:locale/help/:topic */
export default function HelpPage() {
  const { topic } = useLoaderData<typeof helpLoader>();
  const locale = useLocale();
  const t = useT();
  const raw = messageValue<Topic>(`help.topics.${topic}`, locale)!;
  const values = {
    amount: formatPriceShort(siteConfig.freeShippingThreshold, locale),
    standard: formatPrice(siteConfig.standardShipping, locale),
    fast: formatPrice(deliveryPrice("fast", 0), locale),
    standardDays: deliveryDays("standard", locale),
    fastDays: deliveryDays("fast", locale),
    ecoDays: deliveryDays("eco", locale),
    email: siteConfig.supportEmail,
    store: siteConfig.name,
  };
  const f = (s: string) => formatMessage(s, values, locale);
  const sections = raw.sections ?? [];

  return (
    <Container className="max-w-3xl py-14">
      <PageTitle title={f(raw.title)} description={f(raw.intro)} />
      <nav aria-label={t("collection.breadcrumb")} className="text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">{t("common.home")}</Link> / <span className="text-foreground">{f(raw.title)}</span>
      </nav>
      <h1 className="mt-8 text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto sm:text-6xl">{f(raw.title)}</h1>
      <p className="mt-4 text-[15px] text-muted-foreground">{f(raw.intro)}</p>
      {sections.length > 0 && (
        <Accordion key={`${topic}-${locale}`} type="single" defaultValue={["0"]} className="mt-10 divide-y border-y">
          {sections.map((s, i) => (
            <AccordionItem key={i} value={String(i)} className="py-0">
              <AccordionTrigger className="py-5 text-left text-[15px] font-medium">
                {f(s.q)}
                <span aria-hidden="true" className="text-lg font-light transition-transform duration-300 group-data-[state=open]:rotate-45">+</span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">{f(s.a)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Container>
  );
}
