/**
 * Admin activity log: one row per admin action (admin_audit_log, 005_admin_tools.sql).
 * The app role can only add rows — never change or remove them.
 * `details` is a short summary of the change; never put passwords, tokens or addresses in it.
 */
import { type Db, query } from "../../db/pool";

export type AuditEntry = { id: number; at: string; actor: string; action: string; entityType: string; entityId: string; details: Record<string, unknown>; ip: string | null };

export type AuditInput = { actor: string; action: string; entityType: string; entityId: string; details?: Record<string, unknown>; ip?: string };

export async function logAdmin(e: AuditInput, db: Db = { query }) {
  await db.query("INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, details, ip) VALUES ($1, $2, $3, $4, $5, $6)", [
    e.actor,
    e.action,
    e.entityType,
    e.entityId,
    JSON.stringify(e.details ?? {}),
    e.ip ?? null,
  ]);
}

/** Newest first; `before` (an id) pages further back. */
export async function listAudit({ entityType, entityId, before, limit = 100 }: { entityType?: string; entityId?: string; before?: number; limit?: number } = {}): Promise<AuditEntry[]> {
  const { rows } = await query<{ id: number; at: Date; actor: string; action: string; entity_type: string; entity_id: string; details: Record<string, unknown>; ip: string | null }>(
    `SELECT * FROM admin_audit_log
      WHERE ($1::text IS NULL OR entity_type = $1)
        AND ($2::text IS NULL OR entity_id = $2)
        AND ($3::bigint IS NULL OR id < $3)
      ORDER BY id DESC LIMIT $4`,
    [entityType ?? null, entityId ?? null, before ?? null, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actor: r.actor, action: r.action, entityType: r.entity_type, entityId: r.entity_id, details: r.details, ip: r.ip }));
}
