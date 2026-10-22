import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminTable, EmptyState, FilterChips, Th } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { formatDate, useLocale, useT } from "@/i18n";
import { type AuditEntry, adminApi } from "@/lib/admin-api";
import { Link } from "@/lib/router";

const PAGE = 100;
type Kind = "all" | "product" | "order" | "customer" | "review" | "admin";

export async function adminActivityLoader() {
  return { entries: await adminApi.activity() };
}

/** Where an entry's thing can be opened in the admin */
const hrefFor = (e: AuditEntry) =>
  e.entityType === "product" && e.action !== "product.delete" ? `/admin/products/${e.entityId}/edit` : e.entityType === "order" ? `/admin/orders?open=${e.entityId}` : null;

/** /admin/activity — who did what in the admin, newest first (entries can't be edited or deleted). */
export default function AdminActivityPage() {
  const t = useT("admin.activity");
  const ta = useT("admin.activity.actions");
  const ts = useT("orders.status");
  const tr = useT("admin.inventory.reasons");
  const locale = useLocale();
  const initial = useLoaderData<typeof adminActivityLoader>().entries;
  const [entries, setEntries] = useState<AuditEntry[]>(initial as AuditEntry[]);
  const [kind, setKind] = useState<Kind>("all");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length < PAGE);

  const fetchPage = async (k: Kind, before?: number) => adminApi.activity({ entityType: k === "all" ? undefined : k, before });

  const choose = async (k: Kind) => {
    setKind(k);
    setLoading(true);
    try {
      const page = await fetchPage(k);
      setEntries(page);
      setDone(page.length < PAGE);
    } catch {
      toast.error(t("failed"));
    } finally {
      setLoading(false);
    }
  };

  const more = async () => {
    setLoading(true);
    try {
      const page = await fetchPage(kind, entries.at(-1)?.id);
      setEntries((e) => [...e, ...page]);
      setDone(page.length < PAGE);
    } catch {
      toast.error(t("failed"));
    } finally {
      setLoading(false);
    }
  };

  /** A short, readable summary of the details */
  const summary = (e: AuditEntry) => {
    const d = e.details as Record<string, unknown>;
    if (e.action === "order.status") return `${ts(String(d.from))} → ${ts(String(d.to))}`;
    if (e.action === "stock.adjust") return `${Number(d.change) > 0 ? "+" : ""}${d.change} · ${d.size}${d.colour !== "default" ? `, ${d.colour}` : ""} · ${tr(String(d.reason))}${d.note ? ` · ${d.note}` : ""}`;
    if (e.action === "product.update") return [t("fields", { list: (d.changed as string[] | undefined)?.join(", ") || "—" }), (d.prices as unknown[] | undefined)?.length ? t("pricesChanged") : ""].filter(Boolean).join(" · ");
    if (e.action === "order.shipment") return [d.carrier, d.trackingNumber].filter(Boolean).join(" · ") || t("cleared");
    if (e.action === "settings.update") {
      const l = d.lowStockThreshold as { from: number; to: number } | undefined;
      return l ? t("threshold", { from: l.from, to: l.to }) : "";
    }
    if (e.action === "report.export") return `${d.from} – ${d.to}`;
    if (typeof d.slug === "string") return d.slug;
    return "";
  };

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <AdminPageHeader title={t("title")} intro={t("intro")} />
      <div className="mb-4">
        <FilterChips label={t("filterLabel")} value={kind} onChange={choose} options={(["all", "product", "order", "customer", "review", "admin"] as Kind[]).map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
      </div>
      {entries.length === 0 ? (
        <EmptyState>{loading ? t("loading") : t("empty")}</EmptyState>
      ) : (
        <AdminTable minWidth={760} head={<><Th>{t("when")}</Th><Th>{t("who")}</Th><Th>{t("what")}</Th><Th>{t("details")}</Th></>}>
          {entries.map((e) => {
            const href = hrefFor(e);
            return (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5">{formatDate(e.at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }, locale)}</td>
                <td className="px-4 py-2.5">
                  {e.actor}
                  {e.ip && <span className="block text-xs text-muted-foreground">{e.ip}</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className="block">{ta.has(e.action) ? ta(e.action) : e.action}</span>
                  {href ? <Link href={href} className="text-xs underline underline-offset-4">{e.entityId}</Link> : <span className="text-xs text-muted-foreground">{e.entityId}</span>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{summary(e)}</td>
              </tr>
            );
          })}
        </AdminTable>
      )}
      {!done && entries.length > 0 && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" disabled={loading} onClick={more}>
            {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />} {t("loadMore")}
          </Button>
        </div>
      )}
    </Container>
  );
}
