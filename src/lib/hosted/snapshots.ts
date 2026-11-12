import type { Client } from "@libsql/client";
import { SyncEnvelopeSchema, PublishedSnapshotSchema } from "../sync/projection";

export class SyncConflict extends Error {}

export async function acceptSnapshot(database: Client, companyId: string, sourceId: string, input: unknown) {
  const envelope = SyncEnvelopeSchema.parse(input);
  if (envelope.sourceId !== sourceId) throw new SyncConflict("Incorrect sync source.");
  const payload = JSON.stringify(envelope.snapshot);
  const transaction = await database.transaction("write");
  try {
    const existing = (await transaction.execute({ sql: "SELECT source_id, revision, payload_json FROM published_snapshots WHERE company_id = ?", args: [companyId] })).rows[0];
    if (existing && (existing.source_id !== sourceId || Number(existing.revision) > envelope.revision ||
      (Number(existing.revision) === envelope.revision && existing.payload_json !== payload))) {
      throw new SyncConflict("Stale or conflicting revision. Check the source profile before resetting sync.");
    }
    if (!existing || Number(existing.revision) < envelope.revision) {
      await transaction.execute({
        sql: `INSERT INTO published_snapshots (company_id, source_id, revision, payload_json, received_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(company_id) DO UPDATE SET source_id = excluded.source_id, revision = excluded.revision,
          payload_json = excluded.payload_json, received_at = excluded.received_at`,
        args: [companyId, sourceId, envelope.revision, payload, new Date().toISOString()]
      });
    }
    await transaction.commit();
    return envelope.revision;
  } finally { transaction.close(); }
}

export async function readPublishedSnapshot(database: Client, companyId: string) {
  const row = (await database.execute({ sql: "SELECT payload_json, received_at FROM published_snapshots WHERE company_id = ?", args: [companyId] })).rows[0];
  return row ? { snapshot: PublishedSnapshotSchema.parse(JSON.parse(String(row.payload_json))), receivedAt: String(row.received_at) } : null;
}
