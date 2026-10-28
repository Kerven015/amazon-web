import { Eye, EyeOff, LoaderCircle, Search, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, ClearHistoryButton, EmptyState, ErrorState, FilterChips, pick } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { formatDate, useLocale, useT } from "@/i18n";
import { type AdminReview, adminApi } from "@/lib/admin-api";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { ADMIN_BASE } from "@/lib/admin-path";

export async function adminReviewsLoader() {
  return { reviews: await adminApi.reviews() };
}

type Status = "all" | "visible" | "hidden";

/** /admin/reviews — every customer review; hide (keeps it, out of the shop and the rating) or delete. */
export default function AdminReviewsPage() {
  const t = useT("admin.reviews");
  const locale = useLocale();
  const initial = useLoaderData<typeof adminReviewsLoader>().reviews;
  const [reviews, setReviews] = useState<AdminReview[]>(initial);
  const [status, setStatus] = useState<Status>("all");
  const [rating, setRating] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [first, setFirst] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setReviews(await adminApi.reviews({ status, rating: rating ? Number(rating) : undefined, q: query.trim() || undefined }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (first) return setFirst(false);
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [status, rating, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (r: AdminReview) => {
    setBusy(r.id);
    try {
      await adminApi.setReviewHidden(r.id, !r.hidden);
      setReviews((list) => (status === "all" ? list.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)) : list.filter((x) => x.id !== r.id)));
      toast.success(r.hidden ? t("shown") : t("hiddenDone"));
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: AdminReview) => {
    if (!window.confirm(t("confirmDelete", { author: r.author }))) return;
    setBusy(r.id);
    try {
      await adminApi.deleteReview(r.id);
      setReviews((list) => list.filter((x) => x.id !== r.id));
      toast.success(t("deleted"));
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <AdminPageHeader title={t("title")} intro={t("intro")}>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? <LoaderCircle className="inline size-4 animate-spin" aria-label={t("loading")} /> : t("count", { count: reviews.length })}
        </p>
        <ClearHistoryButton what="reviews" onCleared={load} />
      </AdminPageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterChips label={t("filterLabel")} value={status} onChange={setStatus} options={(["all", "visible", "hidden"] as Status[]).map((s) => ({ value: s, label: t(`filters.${s}`) }))} />
        <Select aria-label={t("rating")} value={rating} onChange={(e) => setRating(e.target.value)} wrapperClassName="w-40">
          <option value="">{t("anyRating")}</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{t("stars", { count: n })}</option>
          ))}
        </Select>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : reviews.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className={cn("space-y-3", loading && "opacity-60")}>
          {reviews.map((r) => (
            <li key={r.id} className={cn("rounded-sm border bg-card p-4 text-sm", r.hidden && "border-dashed bg-muted/40")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-0.5" aria-label={t("stars", { count: r.rating })}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />
                      ))}
                    </span>
                    {r.verified && <Badge variant="success">{t("verified")}</Badge>}
                    {r.hidden && <Badge variant="neutral">{t("hiddenBadge")}</Badge>}
                  </p>
                  <p className="mt-1 font-semibold">{r.title || "—"}</p>
                  <p className="mt-1 whitespace-pre-line break-words">{r.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.author}
                    {r.email && ` · ${r.email}`} · {formatDate(r.createdAt, undefined, locale)} ·{" "}
                    <Link href={`${ADMIN_BASE}/products/${r.productId}/edit`} className="underline underline-offset-4">{pick(r.productTitle, locale)}</Link>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => toggle(r)}>
                    {r.hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />} {r.hidden ? t("show") : t("hide")}
                  </Button>
                  <Button size="sm" variant="ghost" className="hover:text-danger" disabled={busy === r.id} onClick={() => remove(r)} aria-label={t("deleteBy", { author: r.author })}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
