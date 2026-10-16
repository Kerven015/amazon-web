import { Bath } from "lucide-react";
import Image from "@/components/ui/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Product photo inside a sized parent (the parent sets the 4:5 box and a cream
 * background, so nothing jumps while loading).
 * - Uses the blur placeholder when the script generated one.
 * - If the file is missing (src "" before the image script has run) or fails to
 *   load, shows a neutral cream tile with a small line icon instead of a broken image.
 */
export function ProductImage({
  src,
  alt,
  blurDataURL,
  sizes,
  priority = false,
  className,
  iconClassName,
  decorative = false,
  style,
}: {
  src: string;
  alt: string;
  blurDataURL?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  iconClassName?: string;
  /** Duplicate/secondary image (e.g. hover crossfade): hidden from screen readers */
  decorative?: boolean;
  style?: React.CSSProperties;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const missing = !src || failedSrc === src;

  if (missing) {
    if (decorative) return null;
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn("absolute inset-0 grid place-items-center bg-cream text-navy/35", className)}
      >
        <Bath className={cn("size-6", iconClassName)} strokeWidth={1.25} aria-hidden="true" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      fill
      sizes={sizes}
      priority={priority}
      placeholder={blurDataURL ? "blur" : "empty"}
      blurDataURL={blurDataURL}
      onError={() => setFailedSrc(src)}
      draggable={false}
      style={style}
      className={cn("object-cover", className)}
    />
  );
}
