import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminTable, EmptyState, FilterChips, Th, pick } from "@/components/admin/admin-ui";
import { Container } from "@/components/layout/container";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { formatDate, useLocale, useT } from "@/i18n";
import { type AdjustReason, type InventoryRow, type StockMovement, adminApi, ApiError } from "@/lib/admin-api";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

export async function adminInventoryLoader() {
  const [inventory, movements] = await Promise.all([adminApi.inventory(), adminApi.movements()]);
  return { inventory, movements };
}

type Level = "all" | "low" | "out";
const REASONS: AdjustReason[] = ["received", "returned", "damaged", "lost", "correction"];
/** Which way each reason moves stock (a correction can go either way) */
const SIGN: Record<AdjustReason, 1 | -1 | 0> = { received: 1, returned: 1, damaged: -1, lost: -1, correction: 0 };
const cellKey = (r: Pick<InventoryRow, "productId" | "size" | "colour">) => `${r.productId}|${r.size}|${r.colour}`;

/** /admin/inventory — stock per size × colour, low-stock alerts, adjustments with a reason, and the history. */
export default function AdminInventoryPage() {
  const t = useT("admin.inventory");
  const locale = useLocale();
  const data = useLoaderData<typeof adminInventoryLoader>();
  const [rows, setRows] = useState(data.inventory.rows);
  const [threshold, setThreshold] = useState(data.inventory.threshold);
  const [movements, setMovements] = useState<StockMovement[]>(data.movements);
  const [level, setLevel] = useState<Level>("all");
  const [query, setQuery] = useState("");
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [tab, setTab] = useState<"stock" | "history">("stock");

  const reload = async () => {
    const [inv, mv] = await Promise.all([adminApi.inventory(), adminApi.movements()]);
    setRows(inv.rows);
    setThreshold(inv.threshold);
    setMovements(mv);
  };

  const counts = useMemo(() => ({ all: rows.length, low: rows.filter((r) => r.level === "low").length, out: rows.filter((r) => r.level === "out").length }), [rows]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (level === "all" || r.level === level) &&
        (!q || [pick(r.title, locale), r.title.en, r.sku ?? "", r.size, r.colour, r.productType].some((s) => s.toLowerCase().includes(q))),
    );
  }, [rows, level, query, locale]);

  return (
    <Container className="py-8">
      <PageTitle title={t("title")} />
      <AdminPageHeader title={t("title")} intro={t("intro")} />

      <ThresholdForm value={threshold} onSaved={async (n) => (setThreshold(n), await reload())} />

      <div role="tablist" aria-label={t("title")} className="mb-4 flex gap-4 border-b">
        {(["stock", "history"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 px-1 pb-2 text-sm", tab === k ? "border-navy font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === "stock" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FilterChips
              label={t("filterLabel")}
              value={level}
              onChange={setLevel}
              options={(["all", "low", "out"] as Level[]).map((l) => ({ value: l, label: t(`levels.${l}`), count: counts[l] }))}
            />
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
            </div>
          </div>
          {shown.length === 0 ? (
            <EmptyState>{rows.length ? t("noMatch") : t("empty")}</EmptyState>
          ) : (
            <AdminTable minWidth={780} head={<><Th>{t("product")}</Th><Th>{t("sku")}</Th><Th>{t("size")}</Th><Th>{t("colour")}</Th><Th right>{t("inStock")}</Th><Th><span className="sr-only">{t("adjust")}</span></Th></>}>
              {shown.map((r) => (
                <tr key={cellKey(r)} className={cn(r.level === "out" && "bg-danger-soft/30")}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/products/${r.productId}/edit`} className="font-medium hover:underline">{pick(r.title, locale)}</Link>
                    {r.hidden && <span className="ml-2 text-xs text-muted-foreground">({t("hidden")})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.sku ?? "—"}</td>
                  <td className="px-4 py-2.5">{r.size}</td>
                  <td className="px-4 py-2.5">{r.colour === "default" ? "—" : r.colour}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      {r.level !== "ok" && <Badge variant={r.level === "out" ? "danger" : "warning"}>{t(`levels.${r.level}`)}</Badge>}
                      <span className="font-semibold">{r.quantity}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(r)} aria-label={t("adjustFor", { name: pick(r.title, locale), size: r.size, colour: r.colour })}>
                      {t("adjust")}
                    </Button>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </>
      ) : (
        <History movements={movements} onMore={async () => {
          const more = await adminApi.movements(undefined, movements.at(-1)?.id);
          setMovements((m) => [...m, ...more]);
          return more.length;
        }} />
      )}

      <AdjustSheet row={adjusting} onClose={() => setAdjusting(null)} onDone={async () => (setAdjusting(null), await reload())} />
    </Container>
  );
}

function ThresholdForm({ value, onSaved }: { value: number; onSaved: (n: number) => Promise<void> }) {
  const t = useT("admin.inventory");
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);
  const n = Number(draft);
  const valid = draft !== "" && Number.isInteger(n) && n >= 0 && n <= 1000;
  return (
    <form
      className="mb-6 flex flex-wrap items-end gap-3 rounded-sm border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        try {
          const saved = await adminApi.saveSettings({ lowStockThreshold: n });
          await onSaved(saved.lowStockThreshold);
          toast.success(t("thresholdSaved"));
        } catch {
          toast.error(t("failed"));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <Label htmlFor="low-threshold" className="mb-1 block text-xs">{t("threshold")}</Label>
        <Input id="low-threshold" type="number" min={0} max={1000} step={1} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-28" aria-invalid={!valid} />
      </div>
      <Button type="submit" size="sm" disabled={!valid || saving || n === value}>{t("save")}</Button>
      <p className="basis-full text-xs text-muted-foreground">{t("thresholdHint")}</p>
    </form>
  );
}

function History({ movements, onMore }: { movements: StockMovement[]; onMore: () => Promise<number> }) {
  const t = useT("admin.inventory");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(movements.length < 100);
  if (!movements.length) return <EmptyState>{t("noHistory")}</EmptyState>;
  return (
    <>
      <AdminTable minWidth={820} head={<><Th>{t("when")}</Th><Th>{t("product")}</Th><Th>{t("variant")}</Th><Th right>{t("change")}</Th><Th right>{t("after")}</Th><Th>{t("reason")}</Th><Th>{t("by")}</Th></>}>
        {movements.map((m) => (
          <tr key={m.id}>
            <td className="whitespace-nowrap px-4 py-2.5">{formatDate(m.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, locale)}</td>
            <td className="px-4 py-2.5">{pick(m.title, locale) === "—" ? m.productId : pick(m.title, locale)}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{[m.size, m.colour === "default" ? "" : m.colour].filter(Boolean).join(", ")}</td>
            <td className={cn("px-4 py-2.5 text-right font-semibold", m.change > 0 ? "text-success" : "text-danger")}>{m.change > 0 ? `+${m.change}` : m.change}</td>
            <td className="px-4 py-2.5 text-right">{m.quantityAfter}</td>
            <td className="px-4 py-2.5">
              {t(`reasons.${m.reason}`)}
              {m.orderId && <Link href={`/admin/orders?open=${m.orderId}`} className="ml-1 underline underline-offset-4">{m.orderId}</Link>}
              {m.note && <span className="block text-xs text-muted-foreground">{m.note}</span>}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{m.actor === "customer" ? t("customer") : m.actor}</td>
          </tr>
        ))}
      </AdminTable>
      {!done && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" disabled={loading} onClick={async () => {
            setLoading(true);
            try {
              if ((await onMore()) < 100) setDone(true);
            } finally {
              setLoading(false);
            }
          }}>
            {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />} {t("loadMore")}
          </Button>
        </div>
      )}
    </>
  );
}

/** Side panel: add or remove units of one size/colour, with a reason. */
function AdjustSheet({ row, onClose, onDone }: { row: InventoryRow | null; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useT("admin.inventory");
  const locale = useLocale();
  const [reason, setReason] = useState<AdjustReason>("received");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setReason("received");
    setAmount("");
    setNote("");
    setDirection(1);
  }, [row]);

  const n = Number(amount);
  const sign = SIGN[reason] || direction;
  const change = Number.isInteger(n) && n > 0 ? n * sign : 0;
  const after = row ? row.quantity + change : 0;
  const valid = change !== 0 && after >= 0 && n <= 10_000;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row || !valid) return;
    setSaving(true);
    try {
      await adminApi.adjustStock({ productId: row.productId, size: row.size, colour: row.colour, change, reason, note });
      toast.success(t("adjusted", { quantity: after }));
      await onDone();
    } catch (err) {
      toast.error(err instanceof ApiError && err.message === "negative_stock" ? t("negative") : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={t("adjustTitle")} bodyClassName="px-5 py-5 sm:px-6">
        {row && (
          <form onSubmit={submit} className="space-y-4 text-sm">
            <p>
              <span className="block font-medium">{pick(row.title, locale)}</span>
              <span className="text-muted-foreground">{[row.size, row.colour === "default" ? "" : row.colour].filter(Boolean).join(", ")} · {t("now", { quantity: row.quantity })}</span>
            </p>
            <div>
              <Label htmlFor="adj-reason" className="mb-1 block text-xs">{t("reason")}</Label>
              <Select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{t(`reasons.${r}`)}</option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{t(`reasonHints.${reason}`)}</p>
            </div>
            {reason === "correction" && (
              <fieldset className="flex gap-4">
                <legend className="sr-only">{t("direction")}</legend>
                {([1, -1] as const).map((d) => (
                  <label key={d} className="inline-flex items-center gap-2">
                    <input type="radio" name="adj-direction" checked={direction === d} onChange={() => setDirection(d)} /> {d > 0 ? t("add") : t("remove")}
                  </label>
                ))}
              </fieldset>
            )}
            <div>
              <Label htmlFor="adj-amount" className="mb-1 block text-xs">{t("units")}</Label>
              <Input id="adj-amount" type="number" min={1} max={10000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="adj-note" className="mb-1 block text-xs">{t("note")}</Label>
              <Input id="adj-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
            </div>
            <p className={cn("font-medium", after < 0 && "text-danger")} aria-live="polite">
              {change ? (after < 0 ? t("negative") : t("result", { from: row.quantity, to: after })) : " "}
            </p>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />} {t("apply")}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
