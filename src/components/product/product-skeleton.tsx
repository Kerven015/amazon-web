import { Bath } from "lucide-react";
import { Container } from "@/components/layout/container";
import { TextShimmer } from "@/components/motion-ui/text-shimmer";
import { Skeleton } from "@/components/ui/misc";
import { useT } from "@/i18n";

/** Same layout as the product page while its data loads. */
export function ProductSkeleton({ title }: { title?: string }) {
  const t = useT("common");
  title ??= t("loadingProduct");
  return (
    <div className="theme-cream">
      <Container className="pb-16" aria-busy="true">
        <div className="py-5">
          <Skeleton className="h-3 w-48 rounded-xs" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-12 xl:gap-16">
          <div className="flex gap-4">
            <div className="hidden w-[76px] shrink-0 flex-col gap-3 md:flex">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full rounded-xs" />
              ))}
            </div>
            <div className="relative grid aspect-[4/5] min-w-0 flex-1 animate-pulse place-items-center rounded-xs bg-cream">
              <Bath className="size-10 text-navy/25" strokeWidth={1.25} aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-5">
            <Skeleton className="h-3.5 w-40 rounded-xs" />
            <h1 className="text-4xl leading-[1.08] sm:text-[44px]">
              <TextShimmer>{title}</TextShimmer>
            </h1>
            <Skeleton className="h-4 w-44 rounded-xs" />
            <Skeleton className="h-8 w-28 rounded-xs" />
            <div className="flex gap-2.5 pt-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="size-8 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 rounded-xs" />
              ))}
            </div>
            <Skeleton className="h-12 w-full rounded-sm" />
            <Skeleton className="h-4 w-56 rounded-xs" />
            <div className="space-y-3 pt-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-px w-full" />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
