import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

export const incidentDraftSchema = z.object({
  clientId: z.string().min(1), type: z.enum(['BT', 'MT']),
  incidentDate: z.string().refine(value => Number.isFinite(Date.parse(value))),
  commune: z.string(), village: z.string(), incidentType: z.string(), departHta: z.string(),
  materialRows: z.array(z.object({ id: z.string(), materialName: z.string(), quantity: z.string() })).min(1),
  description: z.string(), isReclamation: z.boolean(), reclamationName: z.string(),
  reclamationBy: z.string(), selectedImages: z.array(z.string()).max(5),
  currentStep: z.number().int().min(1).max(3),
});
export type IncidentDraft = z.infer<typeof incidentDraftSchema>;

export async function loadIncidentDraft<T>(db: SQLiteDatabase, userId: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ payload_json: string }>(
    'SELECT payload_json FROM incident_drafts WHERE user_id = ?', [userId]);
  if (!row) return null;
  try { return JSON.parse(row.payload_json) as T; }
  catch { throw new Error('Le brouillon enregistré est illisible. Il a été conservé.'); }
}

export async function saveIncidentDraft(db: SQLiteDatabase, userId: string, draft: unknown): Promise<void> {
  await db.runAsync(`INSERT INTO incident_drafts (user_id, payload_json) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = CURRENT_TIMESTAMP`,
  [userId, JSON.stringify(draft)]);
}

export async function clearIncidentDraft(db: SQLiteDatabase, userId: string): Promise<void> {
  await db.runAsync('DELETE FROM incident_drafts WHERE user_id = ?', [userId]);
}

export async function isIncidentPhotoReferenced(db: SQLiteDatabase, uri: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ referenced: number }>(`SELECT
    EXISTS(SELECT 1 FROM incidents i, json_each(CASE WHEN json_valid(i.media_urls) THEN i.media_urls ELSE '[]' END) photo WHERE photo.value = ?)
    OR EXISTS(SELECT 1 FROM sync_operations WHERE status != 'done'
      AND json_extract(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END, '$.localUri') = ?)
    OR EXISTS(SELECT 1 FROM incident_drafts d,
      json_each(CASE WHEN json_valid(d.payload_json) THEN d.payload_json ELSE '{}' END, '$.selectedImages') photo WHERE photo.value = ?)
    AS referenced`, [uri, uri, uri]);
  return Boolean(row?.referenced);
}

const closureDraftSchema = z.object({
  rows: incidentDraftSchema.shape.materialRows,
  choice: z.enum(['used', 'none']).nullable(),
});
export type ClosureDraft = z.infer<typeof closureDraftSchema>;

export async function loadClosureDraft(db: SQLiteDatabase, id: number, userId: string): Promise<ClosureDraft | null> {
  const row = await db.getFirstAsync<{ material_draft: string }>(
    "SELECT material_draft FROM incidents WHERE id = ? AND created_by = ? AND status = 'open'", [id, userId]);
  if (!row) return null;
  const value: unknown = JSON.parse(row.material_draft);
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const rows = incidentDraftSchema.shape.materialRows.parse(value);
    return { rows, choice: rows.some(item => item.materialName.trim() || item.quantity.trim()) ? 'used' : null };
  }
  return closureDraftSchema.parse(value);
}

export async function saveClosureDraft(db: SQLiteDatabase, id: number, userId: string, draft: ClosureDraft): Promise<void> {
  const value = closureDraftSchema.parse(draft);
  await db.runAsync("UPDATE incidents SET material_draft = ? WHERE id = ? AND created_by = ? AND status = 'open'",
    [JSON.stringify(value), id, userId]);
}
