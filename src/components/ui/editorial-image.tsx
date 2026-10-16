import Image, { type ImageProps } from "@/components/ui/image";
import { sceneArt } from "@/lib/art";
import { photo, photoBlur } from "@/lib/images";

/**
 * An editorial photo slot (see lib/editorial.ts): the downloaded photo with a
 * blur preview, or the drawn illustration when there's no photo (or it fails
 * to load). The parent box sets the aspect ratio, so nothing jumps while loading.
 */
export function EditorialImage({ seed, width, height, ...props }: Omit<ImageProps, "src" | "fallbackSrc" | "blurDataURL" | "placeholder"> & { seed: string; width: number; height: number }) {
  const blur = photoBlur(seed);
  return (
    <Image
      {...props}
      src={photo(seed, width, height)}
      fallbackSrc={sceneArt(seed, width, height)}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur}
    />
  );
}
