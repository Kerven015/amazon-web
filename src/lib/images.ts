import { sceneArt } from "@/lib/art";
import manifestJson from "@/lib/mock-data/editorial-manifest.json";
import type { EditorialEntry } from "@/lib/editorial";

const manifest = manifestJson as Record<string, EditorialEntry>;

/**
 * Editorial imagery (hero, collection tiles, quiz banner, newsletter popup).
 * Real photos from /public/images/editorial/ once `npm run images:fetch` has
 * downloaded them (see lib/editorial.ts). Until then — or for a slot whose
 * download failed — a locally drawn towel scene (lib/art.ts), so a box never
 * shows a broken image. Same seed → same picture.
 */
export function photo(seed: string, width: number, height: number) {
  return manifest[seed]?.src ?? sceneArt(seed, width, height);
}

/** Tiny blurred placeholder for a downloaded editorial photo (undefined for illustrations). */
export function photoBlur(seed: string) {
  return manifest[seed]?.blurDataURL;
}

/** True when the slot is still showing an illustration. */
export function isIllustration(seed: string) {
  return !manifest[seed];
}
