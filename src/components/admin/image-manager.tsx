import { ArrowLeft, ArrowRight, ImageOff, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ProductImage } from "@/components/product/product-image";
import { ApiError, adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { adminError } from "@/lib/admin-errors";
import type { ProductImage as Img } from "@/types";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

type Pending = { key: string; name: string; error?: string };

/**
 * Drag-and-drop upload (JPG/PNG/WebP ≤ 5MB, converted to WebP on the server),
 * drag to reorder (first = main image), alt text per image.
 */
export function ImageManager({
  images,
  onChange,
  slug,
  title,
  error,
}: {
  images: Img[];
  onChange: (images: Img[]) => void;
  slug: string;
  title: string;
  error?: string;
}) {
  const id = useId();
  const t = useT("admin.images");
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const latest = useRef(images);
  latest.current = images;

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${Math.random()}`;
      if (!TYPES.includes(file.type)) {
        setPending((p) => [...p, { key, name: file.name, error: t("onlyTypes") }]);
        continue;
      }
      if (file.size > MAX) {
        setPending((p) => [...p, { key, name: file.name, error: t("tooLarge") }]);
        continue;
      }
      setPending((p) => [...p, { key, name: file.name }]);
      try {
        const res = await adminApi.upload(file, slug);
        const alt = title ? (latest.current.length ? t("altAuto", { title, n: latest.current.length + 1 }) : title) : "";
        onChange([...latest.current, { src: res.src, alt, blurDataURL: res.blurDataURL }]);
        setPending((p) => p.filter((x) => x.key !== key));
      } catch (err) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: err instanceof ApiError ? adminError(err.message) : t("uploadFailed") } : x)));
      }
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const isFileDrag = (e: { dataTransfer: DataTransfer }) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center transition-colors",
          over ? "border-navy bg-navy/5" : error ? "border-danger/60" : "border-input",
        )}
      >
        <ImagePlus className="size-7 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
        <p className="text-sm">
          {t.rich("drop", {
            browse: (
              <button type="button" onClick={() => input.current?.click()} className="font-medium underline underline-offset-4">
                {t("browse")}
              </button>
            ),
          })}
        </p>
        <p className="text-xs text-muted-foreground">{t("formats")}</p>
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-danger" role="alert">{error}</p>}

      {images.length === 0 && pending.length === 0 && (
        <div className="mt-3 flex items-start gap-3 rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm" data-testid="images-empty">
          <ImageOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="font-medium">{t("empty")}</p>
            <p className="text-muted-foreground">{t("emptyHint")}</p>
          </div>
        </div>
      )}

      {(images.length > 0 || pending.length > 0) && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={t("listLabel")}>
          {images.map((img, i) => (
            <li
              key={`${img.src.slice(-60)}-${i}`}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                move(dragFrom, i);
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              className={cn("group/img rounded-sm border bg-surface p-2", dragFrom === i && "opacity-40")}
            >
              <div className="relative aspect-[4/5] cursor-grab overflow-hidden rounded-xs bg-cream active:cursor-grabbing">
                <ProductImage src={img.src} alt={img.alt} blurDataURL={img.blurDataURL} sizes="160px" iconClassName="size-4" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-xs bg-navy px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream">{t("main")}</span>}
                <button
                  type="button"
                  aria-label={t("remove", { n: i + 1 })}
                  onClick={() => onChange(images.filter((_, n) => n !== i))}
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-surface/90 text-danger shadow-card hover:bg-danger hover:text-white"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition-opacity group-hover/img:opacity-100 group-focus-within/img:opacity-100">
                  <button type="button" aria-label={t("earlier", { n: i + 1 })} disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-7 place-items-center rounded-full bg-surface/90 disabled:opacity-30">
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={t("later", { n: i + 1 })} disabled={i === images.length - 1} onClick={() => move(i, i + 1)} className="grid size-7 place-items-center rounded-full bg-surface/90 disabled:opacity-30">
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <label className="mt-2 block">
                <span className="sr-only">{t("altLabel", { n: i + 1 })}</span>
                <input
                  value={img.alt}
                  onChange={(e) => onChange(images.map((x, n) => (n === i ? { ...x, alt: e.target.value } : x)))}
                  placeholder={t("altPlaceholder")}
                  className="h-8 w-full rounded-xs border border-input bg-transparent px-2 text-xs outline-none focus:border-navy"
                />
              </label>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="rounded-sm border bg-surface p-2">
              <div className="grid aspect-[4/5] place-items-center rounded-xs bg-cream p-2 text-center text-xs">
                {p.error ? (
                  <span className="text-danger">
                    {p.name}
                    <br />
                    {p.error}
                    <button type="button" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))} className="mt-2 block w-full underline">
                      {t("dismiss")}
                    </button>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />
                    {t("uploading")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
