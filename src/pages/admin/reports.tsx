import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminTable, BarChart, EmptyState, ErrorState, FilterChips, StatTile, Th } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatDate, formatPrice, useLocale, useT } from "@/i18n";
import { adminApi, adminTimeZone, type ReportGroup, type ReportQuery, type SalesReport } from "@/lib/admin-api";

/** YYYY-MM-DD of a local date, `days` from today */
const localDay = (days = 0, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Preset = "7" | "30" | "90" | "month" | "year";
function presetRange(p: Preset): { from: string; to: string; group: ReportGroup } {
  const now = new Date();
  if (p === "month") return { from: localDay(0, new Date(now.getFullYear(), now.getMonth(), 1)), to: localDay(), group: "day" };
  if (p === "year") return { from: localDay(0, new Date(now.getFullYear(), 0, 1)), to: localDay(), group: "month" };
  return { from: localDay(1 - Number(p)), to: localDay(), group: p === "90" ? "week" : "day" };
}

export async function adminReportsLoader() {
  const query: ReportQuery = { ...presetRange("30"), tz: adminTimeZone() };
  return { query, report: await adminApi.salesReport(query) };
}

type Breakdown = "product" | "category" | "size" | "colour" | "code";

/** /admin/reports — sales for a date range, per product / category / size / colour, and CSV exports. */
export default function AdminReportsPage() {
  const t = useT("admin.reports");
  const locale = useLocale();
  const data = useLoaderData<typeof adminReportsLoader>();
  const [query, setQuery] = useState<ReportQuery>(data.query);
  const [preset, setPreset] = useState<Preset | "custom">("30");
  const [report, setReport] = useState<SalesReport | null>(data.report);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown>("product");
  const price = (n: number) => formatPrice(n, locale);
  const valid = !!query.from && !!query.to && query.from <= query.to;

  const load = async (q: ReportQuery) => {
    setLoading(true);
    setError(false);
    try {
      setReport(await adminApi.salesReport(q));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) return setFirst(false);
    if (valid) void load(query);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodLabel = (k: string) =>
    formatDate(`${k}T12:00:00`, query.group === "month" ? { month: "short", year: "numeric" } : { day: "numeric", month: "short" }, locale);

  const s = report?.summary;
  const rows =
    !report ? [] :
    breakdown === "product" ? report.byProduct.map((p) => ({ key: p.productId, label: p.title, sub: p.sku, units: p.units, orders: p.orders, sales: p.sales })) :
    breakdown === "code" ? report.byDiscountCode.map((c) => ({ key: c.code, label: c.code, sub: null, units: null, orders: c.orders, sales: c.discounts })) :
    (breakdown === "category" ? report.byCategory : breakdown === "size" ? report.bySize : report.byColour).map((r) => ({ key: r.key ?? "none", label: r.key ?? t("none"), sub: null, units: r.units as number | null, orders: r.orders, sales: r.sales }));

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <AdminPageHeader title={t("title")} intro={t("intro")}>
        {(["orders", "products"] as const).map((type) => (
          <a key={type} href={valid ? adminApi.exportUrl(type, query) : undefined} aria-disabled={!valid} className={buttonVariants({ variant: "outline", size: "sm" })} download>
            <Download aria-hidden="true" /> {t(`export.${type}`)}
          </a>
        ))}
      </AdminPageHeader>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <FilterChips
          label={t("range")}
          value={preset}
          onChange={(p) => {
            setPreset(p);
            if (p !== "custom") setQuery((q) => ({ ...q, ...presetRange(p) }));
          }}
          options={(["7", "30", "90", "month", "year"] as Preset[]).map((p) => ({ value: p, label: t(`presets.${p}`) }))}
        />
        <div>
          <Label htmlFor="rep-from" className="mb-1 block text-xs">{t("from")}</Label>
          <Input id="rep-from" type="date" value={query.from} max={query.to} onChange={(e) => (setPreset("custom"), setQuery((q) => ({ ...q, from: e.target.value })))} />
        </div>
        <div>
          <Label htmlFor="rep-to" className="mb-1 block text-xs">{t("to")}</Label>
          <Input id="rep-to" type="date" value={query.to} min={query.from} onChange={(e) => (setPreset("custom"), setQuery((q) => ({ ...q, to: e.target.value })))} />
        </div>
        <div>
          <Label htmlFor="rep-group" className="mb-1 block text-xs">{t("groupBy")}</Label>
          <Select id="rep-group" value={query.group} onChange={(e) => setQuery((q) => ({ ...q, group: e.target.value as ReportGroup }))}>
            {(["day", "week", "month"] as const).map((g) => (
              <option key={g} value={g}>{t(`groups.${g}`)}</option>
            ))}
          </Select>
        </div>
        {loading && <LoaderCircle className="mb-3 size-4 animate-spin text-muted-foreground" aria-label={t("loading")} />}
      </div>

      {!valid ? (
        <EmptyState>{t("invalidRange")}</EmptyState>
      ) : error ? (
        <ErrorState onRetry={() => load(query)} />
      ) : !report || !s ? null : (
        <div className={loading ? "opacity-60" : undefined}>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t("total")} value={price(s.total)} sub={t("totalHint")} />
            <StatTile label={t("orders")} value={s.orders} sub={t("units", { count: s.units })} />
            <StatTile label={t("averageOrder")} value={price(s.averageOrder)} />
            <StatTile label={t("cancelled")} value={s.cancelledOrders} sub={price(s.cancelledTotal)} />
          </div>
          <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded-sm border bg-card p-4 text-sm sm:grid-cols-5">
            {([["gross", s.gross], ["discounts", -s.discounts], ["netSales", s.netSales], ["shipping", s.shipping], ["tax", s.tax]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{t(k)}</dt>
                <dd className="price font-semibold">{price(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="-mt-4 mb-6 text-xs text-muted-foreground">{t("definitions")}</p>

          <div className="mb-8">
            <BarChart label={t("chart")} data={report.series.map((p) => ({ key: p.period, value: p.total }))} format={price} formatKey={periodLabel} />
          </div>

          <h2 className="mb-3 text-xl">{t("breakdown")}</h2>
          <div className="mb-3">
            <FilterChips label={t("breakdown")} value={breakdown} onChange={setBreakdown} options={(["product", "category", "size", "colour", "code"] as Breakdown[]).map((b) => ({ value: b, label: t(`by.${b}`) }))} />
          </div>
          {rows.length === 0 ? (
            <EmptyState>{t("noSales")}</EmptyState>
          ) : (
            <AdminTable
              minWidth={560}
              head={<><Th>{t(`by.${breakdown}`)}</Th>{breakdown !== "code" && <Th right>{t("unitsCol")}</Th>}<Th right>{t("ordersCol")}</Th><Th right>{breakdown === "code" ? t("discounts") : t("itemSales")}</Th></>}
            >
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2.5">
                    {r.label}
                    {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
                  </td>
                  {breakdown !== "code" && <td className="px-4 py-2.5 text-right">{r.units}</td>}
                  <td className="px-4 py-2.5 text-right">{r.orders}</td>
                  <td className="price px-4 py-2.5 text-right">{price(r.sales)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
          {breakdown !== "code" && <p className="mt-2 text-xs text-muted-foreground">{t("itemSalesHint")}</p>}
          <p className="mt-6 text-xs text-muted-foreground">{t("noProfit")}</p>
        </div>
      )}
    </Container>
  );
}
