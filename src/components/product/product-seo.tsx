import { useEffect } from "react";
import { siteConfig } from "@/lib/config";
import { productHref, stockFor } from "@/lib/product-utils";
import { localizePath, useLocale } from "@/i18n";
import type { Product } from "@/types";

/**
 * Title, description, Open Graph tags and Product JSON-LD.
 * React 19 hoists <title>/<meta>/<link> into <head> automatically.
 *
 * Note: this is a client-rendered app (Vite), so these tags are added after the
 * page loads. Google renders JavaScript and will read them; most social-media
 * crawlers don't — for link previews, prerender product pages or move to SSR.
 */
export function ProductSeo({ product }: { product: Product }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const locale = useLocale();
  // Language-specific URL; name and description are already in this language
  const url = `${origin}${localizePath(productHref(product), locale)}`;
  const title = `${product.title} | ${siteConfig.name}`;
  const description = [product.tagline, product.description].filter(Boolean).join(". ").replace(/\.\./g, ".").slice(0, 300);

  // Social crawlers need an absolute http(s) URL; the built-in illustrations are data URIs.
  const raw = product.images[0]?.src ?? "";
  const image = raw && !raw.startsWith("data:") ? (raw.startsWith("http") ? raw : `${origin}${raw}`) : undefined;

  // index.html already has a site-wide description: update it in place (no duplicate tag)
  useEffect(() => {
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) return;
    const previous = tag.content;
    tag.content = description;
    return () => {
      tag.content = previous;
    };
  }, [description]);

  const inStock = stockFor(product) > 0;
  const prices = (product.sizes ?? []).map((s) => s.salePrice ?? s.price);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    inLanguage: locale,
    name: product.title,
    description,
    sku: product.sku ?? product.id,
    brand: { "@type": "Brand", name: product.brand },
    image: image ? [image] : undefined,
    url,
    offers:
      prices.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: siteConfig.currency,
            lowPrice: Math.min(...prices).toFixed(2),
            highPrice: Math.max(...prices).toFixed(2),
            offerCount: prices.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          }
        : {
            "@type": "Offer",
            priceCurrency: siteConfig.currency,
            price: product.price.toFixed(2),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url,
          },
    aggregateRating: product.reviewCount
      ? { "@type": "AggregateRating", ratingValue: product.rating.toFixed(1), reviewCount: product.reviewCount }
      : undefined,
  };

  return (
    <>
      <title>{title}</title>
      <meta property="og:type" content="product" />
      <meta property="og:locale" content={{ en: "en_US", tr: "tr_TR", tk: "tk_TM", ru: "ru_RU" }[locale]} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped is safe inside a script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
