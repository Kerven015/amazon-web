/**
 * Image upload: JPG / PNG / WebP up to 5MB → converted to WebP with sharp and
 * saved to public/images/products/{slug}/. Returns the public path + a tiny
 * blurred placeholder.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export class UploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Check the file's first bytes, not just the Content-Type header. */
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function uploadDir() {
  return path.resolve(process.cwd(), env("UPLOAD_DIR") ?? "public/images/products");
}

export async function saveUpload(body: Buffer, contentType: string, rawSlug: string, rawName: string) {
  if (!body.length) throw new UploadError("The file is empty");
  if (body.length > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 5MB or smaller", 413);
  const type = contentType.split(";")[0].trim().toLowerCase();
  const actual = sniff(body);
  if (!TYPES.includes(type) || !actual) throw new UploadError("Only JPG, PNG or WebP images are allowed", 415);

  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120) || "untitled";
  const base = path.parse(rawName).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "image";
  const fileName = `${base}-${randomBytes(3).toString("hex")}.webp`;
  const dir = path.join(uploadDir(), slug);

  const sharp = (await import("sharp")).default;
  let webp: Buffer;
  let blur: Buffer;
  let meta: { width?: number; height?: number };
  try {
    const img = sharp(body, { limitInputPixels: 40_000_000 }).rotate();
    meta = await img.metadata();
    webp = await img.clone().resize({ width: 2000, height: 2500, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    blur = await sharp(webp).resize(16).blur().webp({ quality: 40 }).toBuffer();
  } catch {
    throw new UploadError("That file couldn't be read as an image", 415);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, fileName), webp);
  return {
    src: `/images/products/${slug}/${fileName}`,
    blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    width: meta.width,
    height: meta.height,
  };
}
