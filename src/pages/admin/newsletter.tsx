import { Download, LoaderCircle, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminTable, EmptyState, ErrorState, FilterChips, Th } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { formatDate, useLocale, useT } from "@/i18n";
import { type Subscriber, adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export async function adminNewsletterLoader() {
  return await adminApi.subscribers();
}

type Status = "subscribed" | "unsubscribed" | "all";

/** /admin/newsletter — who signed up, CSV export (with unsubscribe links) for an email service, delete. */
export default function AdminNewsletterPage() {
  const t = useT("admin.newsletter");
  const locale = useLocale();
  const initial = useLoaderData<typeof adminNewsletterLoader>();
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<Status>("subscribed");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [first, setFirst] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await adminApi.subscribers({ status, q: query.trim() || undefined }));
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
  }, [status, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (s: Subscriber) => {
    if (!window.confirm(t("confirmDelete", { email: s.email }))) return;
    setBusy(s.id);
    try {
      await adminApi.deleteSubscriber(s.id);
      toast.success(t("deleted"));
      await load();
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
        <a href={adminApi.newsletterExportUrl} className={buttonVariants({ variant: "outline", size: "sm" })} download>
          <Download aria-hidden="true" /> {t("export", { count: data.counts.subscribed })}
        </a>
      </AdminPageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterChips
          label={t("filterLabel")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "subscribed", label: t("filters.subscribed"), count: data.counts.subscribed },
            { value: "unsubscribed", label: t("filters.unsubscribed"), count: data.counts.unsubscribed },
            { value: "all", label: t("filters.all"), count: data.counts.subscribed + data.counts.unsubscribed },
          ]}
        />
        {loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label={t("loading")} />}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : data.subscribers.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <AdminTable minWidth={640} head={<><Th>{t("email")}</Th><Th>{t("language")}</Th><Th>{t("since")}</Th><Th>{t("status")}</Th><Th><span className="sr-only">{t("delete")}</span></Th></>}>
          {data.subscribers.map((s) => (
            <tr key={s.id} className={cn(loading && "opacity-60")}>
              <td className="px-4 py-2.5">
                <span className="break-all">{s.email}</span>
                {s.customer && <span className="ml-2 rounded-xs border px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">{t("customer")}</span>}
              </td>
              <td className="px-4 py-2.5 uppercase">{s.locale}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatDate(s.subscribedAt, undefined, locale)}</td>
              <td className="px-4 py-2.5">
                {s.unsubscribedAt ? <Badge variant="neutral">{t("unsubscribedOn", { date: formatDate(s.unsubscribedAt, undefined, locale) })}</Badge> : <Badge variant="success">{t("subscribed")}</Badge>}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button size="sm" variant="ghost" className="hover:text-danger" disabled={busy === s.id} onClick={() => remove(s)} aria-label={t("deleteNamed", { email: s.email })}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">{t("howTo")}</p>
    </Container>
  );
}
