import { type CSSProperties, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight stand-in for next/image (same props the components use):
 * - `fill` stretches the image over its positioned parent (object-fit via className)
 * - `priority` loads eagerly with high fetch priority; everything else is lazy
 * - `placeholder="blur"` + `blurDataURL` shows the tiny preview until the photo loads
 * - `sizes` is passed through for responsive hints
 */
export type ImageProps = {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
  onError?: () => void;
  /** Shown instead if `src` fails to load (e.g. a deleted photo file). */
  fallbackSrc?: string;
  "aria-hidden"?: boolean;
};

export default function Image({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  placeholder = "empty",
  blurDataURL,
  className,
  style,
  draggable,
  onError,
  fallbackSrc,
  "aria-hidden": ariaHidden,
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const useFallback = !!fallbackSrc && failed === src;
  const showBlur = placeholder === "blur" && blurDataURL && !loaded;

  return (
    <img
      src={useFallback ? fallbackSrc : src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={draggable}
      aria-hidden={ariaHidden}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (fallbackSrc && failed !== src) setFailed(src);
        onError?.();
      }}
      className={cn(fill && "absolute inset-0 h-full w-full", className)}
      style={{
        ...(showBlur
          ? { backgroundImage: `url("${blurDataURL}")`, backgroundSize: "cover", backgroundPosition: "center" }
          : null),
        ...style,
      }}
    />
  );
}
