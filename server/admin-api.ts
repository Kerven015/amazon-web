/**
 * Admin tools (called by server/app.ts after the admin session check):
 *
 *   GET   /api/admin/dashboard?tz=                    today / last 30 days, orders to pack & ship, low stock…
 *   GET   /api/admin/orders/:id                       one order (SKUs, shipment, customer id)
 *   PATCH /api/admin/orders/:id/shipment              { carrier, trackingNumber }
 *   GET   /api/admin/inventory                        every stock cell + the low-stock threshold
 *   POST  /api/admin/inventory/adjust                 { productId, size, colour, change, reason, note }
 *   GET   /api/admin/inventory/movements?productId=&before=
 *   GET   /api/admin/settings · PUT { lowStockThreshold }
 *   GET   /api/admin/reviews?q=&status=&rating=
 *   POST  /api/admin/reviews/:id/hide                 { hidden }
 *   DELETE /api/admin/reviews/:id
 *   GET   /api/admin/reports/sales?from=&to=&tz=&group=day|week|month
 *   GET   /api/admin/reports/export?type=orders|products&from=&to=&tz=   → CSV
 *   GET   /api/admin/activity?entityType=&entityId=&before=
 *   GET   /api/admin/notifications                    what's new per section since the admin last looked
 *   POST  /api/admin/notifications/seen               { section } → that count starts again from 0
 *   GET   /api/admin/history/:section                 how many rows "Clear history" would delete
 *   POST  /api/admin/history/:section/clear           { confirm: true } → deletes them (clear-history.ts)
 *
 * Every change is written to the activity log (audit.ts).
 */
import { z } from "zod";
import { type AuditInput, listAudit } from "./lib/db/audit";
import { adjustStock, ADJUST_REASONS, listInventory, listMovements, StockError } from "./lib/db/inventory";
import { adminGetOrder, adminSetShipment } from "./lib/db/orders";
import { dashboard, ordersCsv, productsCsv, salesReport } from "./lib/db/reports";
import { deleteReview, listReviews, setReviewHidden } from "./lib/db/reviews";
import { getSettings, saveSettings } from "./lib/db/settings";
import { getNotifications, markSeen, SECTIONS } from "./lib/db/notifications";
import { CLEARABLE, type Clearable, clearHistory, clearPreview } from "./lib/db/clear-history";
import { clientIp } from "./auth";
import type { Db } from "./db/pool";
import { parseBody, parseQuery, type Req, type Res, send } from "./http";

/** Writes an activity-log entry for the signed-in admin (pass `db` to write it inside a transaction). */
export type Audit = (e: Omit<AuditInput, "actor" | "ip">, db?: Db) => Promise<void>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((s) => !Number.isNaN(Date.parse(s)), "Not a date");
const rangeSchema = z
  .object({ from: day, to: day, tz: z.string().max(64).optional(), group: z.enum(["day", "week", "month"]).optional() })
  .refine((r) => r.from <= r.to, { message: "The start must be before the end", path: ["from"] })
  // A year of days at most, so one request can't build a huge series
  .refine((r) => Date.parse(r.to) - Date.parse(r.from) <= 400 * 86_400_000, { message: "Choose a range of at most 400 days", path: ["to"] });

const adjustSchema = z.object({
  productId: z.string().min(1).max(100),
  size: z.string().min(1).max(100),
  colour: z.string().min(1).max(100),
  change: z.number().int().min(-10_000).max(10_000).refine((n) => n !== 0, "Enter a number other than 0"),
  reason: z.enum(ADJUST_REASONS),
  note: z.string().trim().max(300).default(""),
});

const shipmentSchema = z.object({
  carrier: z.string().trim().max(60),
  trackingNumber: z.string().trim().max(100).regex(/^[A-Za-z0-9 \-./]*$/, "Letters, numbers, spaces and - . / only"),
});

const before = z.coerce.number().int().positive().optional();

export async function handleAdminTools(req: Req, res: Res, url: URL, method: string, actor: string, audit: Audit): Promise<boolean> {
  const p = url.pathname;

  if (p === "/api/admin/dashboard" && method === "GET") {
    return send(res, 200, await dashboard(url.searchParams.get("tz"))), true;
  }

  /* ---- orders ---- */
  const order = p.match(/^\/api\/admin\/orders\/(VD-\d{6})(?:\/(shipment))?$/);
  if (order) {
    const [, id, action] = order;
    if (!action && method === "GET") {
      const o = await adminGetOrder(id);
      return send(res, o ? 200 : 404, o ?? { error: "Not found" }), true;
    }
    if (action === "shipment" && method === "PATCH") {
      const body = await parseBody(req, shipmentSchema, 2_000);
      const o = await adminSetShipment(id, body.carrier, body.trackingNumber);
      if (!o) return send(res, 404, { error: "Not found" }), true;
      await audit({ action: "order.shipment", entityType: "order", entityId: id, details: { carrier: body.carrier, trackingNumber: body.trackingNumber } });
      return send(res, 200, o), true;
    }
  }

  /* ---- inventory & settings ---- */
  if (p === "/api/admin/inventory" && method === "GET") return send(res, 200, await listInventory()), true;
  if (p === "/api/admin/inventory/movements" && method === "GET") {
    const q = parseQuery(url, z.object({ productId: z.string().max(100).optional(), before }));
    return send(res, 200, await listMovements(q)), true;
  }
  if (p === "/api/admin/inventory/adjust" && method === "POST") {
    const body = await parseBody(req, adjustSchema, 2_000);
    try {
      const result = await adjustStock(body, actor, (client, quantity) =>
        audit({ action: "stock.adjust", entityType: "product", entityId: body.productId, details: { size: body.size, colour: body.colour, change: body.change, quantityAfter: quantity, reason: body.reason, note: body.note } }, client),
      );
      return send(res, 200, result), true;
    } catch (err) {
      if (err instanceof StockError) return send(res, err.code === "not_found" ? 404 : 409, { error: err.code }), true;
      throw err;
    }
  }
  if (p === "/api/admin/settings") {
    if (method === "GET") return send(res, 200, await getSettings()), true;
    if (method === "PUT") {
      const body = await parseBody(req, z.object({ lowStockThreshold: z.number().int().min(0).max(1000) }), 1_000);
      const before = await getSettings();
      const saved = await saveSettings(body);
      await audit({ action: "settings.update", entityType: "settings", entityId: "shop", details: { lowStockThreshold: { from: before.lowStockThreshold, to: saved.lowStockThreshold } } });
      return send(res, 200, saved), true;
    }
  }

  /* ---- reviews ---- */
  if (p === "/api/admin/reviews" && method === "GET") {
    const q = parseQuery(url, z.object({ q: z.string().max(200).optional(), status: z.enum(["all", "visible", "hidden"]).optional(), rating: z.coerce.number().int().min(1).max(5).optional() }));
    return send(res, 200, await listReviews(q)), true;
  }
  const review = p.match(/^\/api\/admin\/reviews\/([A-Za-z0-9-]{1,64})(?:\/(hide))?$/);
  if (review) {
    const [, id, action] = review;
    if (action === "hide" && method === "POST") {
      const { hidden } = await parseBody(req, z.object({ hidden: z.boolean() }), 1_000);
      const productId = await setReviewHidden(id, hidden);
      if (!productId) return send(res, 404, { error: "Not found" }), true;
      await audit({ action: hidden ? "review.hide" : "review.show", entityType: "review", entityId: id, details: { productId } });
      return send(res, 200, { id, hidden }), true;
    }
    if (!action && method === "DELETE") {
      const removed = await deleteReview(id);
      if (!removed) return send(res, 404, { error: "Not found" }), true;
      await audit({ action: "review.delete", entityType: "review", entityId: id, details: removed });
      return send(res, 200, { deleted: id }), true;
    }
  }

  /* ---- reports ---- */
  if (p === "/api/admin/reports/sales" && method === "GET") {
    return send(res, 200, await salesReport(parseQuery(url, rangeSchema))), true;
  }
  if (p === "/api/admin/reports/export" && method === "GET") {
    const q = parseQuery(url, z.object({ type: z.enum(["orders", "products"]) }).and(rangeSchema));
    const csv = q.type === "orders" ? await ordersCsv(q) : await productsCsv(q);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="vendora-${q.type}-${q.from}-to-${q.to}.csv"`);
    res.end("﻿" + csv);
    await audit({ action: "report.export", entityType: "report", entityId: q.type, details: { from: q.from, to: q.to } });
    return true;
  }

  /* ---- notifications ---- */
  if (p === "/api/admin/notifications" && method === "GET") return send(res, 200, await getNotifications(actor)), true;
  if (p === "/api/admin/notifications/seen" && method === "POST") {
    const { section } = await parseBody(req, z.object({ section: z.enum(SECTIONS) }), 1_000);
    await markSeen(actor, section);
    return send(res, 200, await getNotifications(actor)), true;
  }

  /* ---- clear history ---- */
  const history = p.match(/^\/api\/admin\/history\/([a-z]+)(\/clear)?$/);
  if (history && (CLEARABLE as readonly string[]).includes(history[1])) {
    const what = history[1] as Clearable;
    if (!history[2] && method === "GET") return send(res, 200, { count: await clearPreview(what) }), true;
    if (history[2] && method === "POST") {
      // An explicit confirmation in the body, so a stray request can't wipe anything
      await parseBody(req, z.object({ confirm: z.literal(true) }), 1_000);
      const removed = await clearHistory(what, actor, clientIp(req));
      // Clearing the activity log writes its own entry (clear_admin_audit_log)
      if (what !== "activity") await audit({ action: "history.clear", entityType: "admin", entityId: what, details: { removed } });
      return send(res, 200, { removed }), true;
    }
  }

  /* ---- activity log ---- */
  if (p === "/api/admin/activity" && method === "GET") {
    const q = parseQuery(url, z.object({ entityType: z.string().max(40).optional(), entityId: z.string().max(100).optional(), before }));
    return send(res, 200, await listAudit(q)), true;
  }

  return false;
}

